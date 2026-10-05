import type { ApplicationStatus, IdType } from '@prisma/client';
import { isCloudinaryConfigured } from '../config/cloudinary';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import { generateOneTimePassword } from '../utils/oneTimePassword';
import { hashPassword } from '../utils/password';
import type {
  CreateTechnicianApplicationInput,
  ListTechnicianApplicationsQueryInput,
} from '../validators/technician-application.validator';
import { writeAuditLog } from './audit.service';
import { buildCredentialsEmail, buildRejectionEmail, sendMail } from './mail.service';
import { createNotification, notifyAdmins } from './notification.service';
import { getPremiumStatus } from './premium.service';
import { deleteAsset, getSignedImageUrl, uploadPrivateImage } from './upload.service';

export interface ApplicationSkillItem {
  id: string;
  name: string;
}

export interface SubmittedApplicationResult {
  id: string;
  status: ApplicationStatus;
  yearsOfExperience: number;
  idType: IdType;
  phone: string;
  address: string;
  serviceArea: string;
  bio: string;
  skills: ApplicationSkillItem[];
  createdAt: Date;
}

export interface MyApplicationResult extends SubmittedApplicationResult {
  rejectionReason: string | null;
  reviewedAt: Date | null;
}

export const applyAsTechnician = async (
  userId: string,
  input: CreateTechnicianApplicationInput,
  file?: Express.Multer.File,
): Promise<SubmittedApplicationResult> => {
  if (!isCloudinaryConfigured()) {
    throw new ApiError(503, 'File upload is not configured');
  }

  if (!file) {
    throw new ApiError(422, 'ID document image is required', [
      { field: 'idDocument', message: 'ID document image is required' },
    ]);
  }

  const user = await prisma.user.findFirst({
    where: { id: userId, deletedAt: null },
  });

  if (user?.role !== 'CUSTOMER' || user.status !== 'ACTIVE') {
    throw new ApiError(403, 'User is not eligible to apply as a technician');
  }

  const existingApp = await prisma.technicianApplication.findUnique({
    where: { userId },
  });

  if (existingApp) {
    throw new ApiError(409, 'You have already submitted a technician application');
  }

  const dupId = await prisma.technicianApplication.findUnique({
    where: {
      idType_idNumber: {
        idType: input.idType,
        idNumber: input.idNumber,
      },
    },
  });

  if (dupId) {
    throw new ApiError(409, 'This ID number is already used in another application');
  }

  const skillsCount = await prisma.skill.count({
    where: { id: { in: input.skillIds } },
  });

  if (skillsCount !== input.skillIds.length) {
    throw new ApiError(422, 'One or more skills are invalid');
  }

  const uploadRes = await uploadPrivateImage(file.buffer, 'field-service/technician-ids');

  try {
    const application = await prisma.$transaction(async (tx) => {
      const app = await tx.technicianApplication.create({
        data: {
          userId,
          status: 'PENDING',
          yearsOfExperience: input.yearsOfExperience,
          idType: input.idType,
          idNumber: input.idNumber,
          phone: input.phone,
          address: input.address,
          serviceArea: input.serviceArea,
          bio: input.bio,
          idDocumentUrl: uploadRes.url,
          idDocumentPublicId: uploadRes.publicId,
          skills: {
            create: input.skillIds.map((skillId) => ({ skillId })),
          },
        },
        include: {
          skills: {
            include: {
              skill: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      });

      await notifyAdmins(
        {
          type: 'TECHNICIAN_APPLICATION_SUBMITTED',
          title: 'New technician application',
          message: `${user.name} submitted a technician application`,
          data: { applicationId: app.id },
        },
        tx,
      );

      return app;
    });

    return {
      id: application.id,
      status: application.status,
      yearsOfExperience: application.yearsOfExperience,
      idType: application.idType,
      phone: application.phone,
      address: application.address,
      serviceArea: application.serviceArea,
      bio: application.bio,
      skills: application.skills.map((s) => ({
        id: s.skill.id,
        name: s.skill.name,
      })),
      createdAt: application.createdAt,
    };
  } catch (err: unknown) {
    await deleteAsset(uploadRes.publicId).catch(() => {});
    if (
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      (err as { code: string }).code === 'P2002'
    ) {
      throw new ApiError(409, 'You have already submitted a technician application');
    }
    throw err;
  }
};

export const getMyApplication = async (userId: string): Promise<MyApplicationResult> => {
  const application = await prisma.technicianApplication.findUnique({
    where: { userId },
    include: {
      skills: {
        include: {
          skill: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!application) {
    throw new ApiError(404, 'No application found');
  }

  return {
    id: application.id,
    status: application.status,
    yearsOfExperience: application.yearsOfExperience,
    idType: application.idType,
    phone: application.phone,
    address: application.address,
    serviceArea: application.serviceArea,
    bio: application.bio,
    rejectionReason: application.rejectionReason,
    reviewedAt: application.reviewedAt,
    skills: application.skills.map((s) => ({
      id: s.skill.id,
      name: s.skill.name,
    })),
    createdAt: application.createdAt,
  };
};

export const listApplications = async ({
  page,
  limit,
  status,
}: ListTechnicianApplicationsQueryInput) => {
  const where = status ? { status } : {};
  const skip = (page - 1) * limit;

  const [items, total] = await Promise.all([
    prisma.technicianApplication.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        yearsOfExperience: true,
        idType: true,
        serviceArea: true,
        skills: {
          select: {
            skill: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        createdAt: true,
      },
    }),
    prisma.technicianApplication.count({ where }),
  ]);

  const formattedItems = items.map((item) => ({
    id: item.id,
    status: item.status,
    applicant: item.user,
    yearsOfExperience: item.yearsOfExperience,
    idType: item.idType,
    serviceArea: item.serviceArea,
    skills: item.skills.map((s) => ({
      id: s.skill.id,
      name: s.skill.name,
    })),
    createdAt: item.createdAt,
  }));

  return { items: formattedItems, page, limit, total };
};

export const getApplicationById = async (id: string) => {
  const application = await prisma.technicianApplication.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          name: true,
        },
      },
      skills: {
        include: {
          skill: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!application) {
    throw new ApiError(404, 'Technician application not found');
  }

  const signedUrl = getSignedImageUrl(application.idDocumentPublicId, application.idDocumentUrl);

  return {
    id: application.id,
    status: application.status,
    yearsOfExperience: application.yearsOfExperience,
    idType: application.idType,
    idNumber: application.idNumber,
    phone: application.phone,
    address: application.address,
    serviceArea: application.serviceArea,
    bio: application.bio,
    idDocumentUrl: signedUrl,
    applicant: {
      id: application.user.id,
      name: application.user.name,
      email: application.user.email,
      role: application.user.role,
    },
    skills: application.skills.map((s) => ({
      id: s.skill.id,
      name: s.skill.name,
    })),
    reviewer: application.reviewedBy
      ? {
          id: application.reviewedBy.id,
          name: application.reviewedBy.name,
        }
      : null,
    reviewedAt: application.reviewedAt,
    rejectionReason: application.rejectionReason,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
};

export const approveApplication = async (id: string, admin: { id: string; ip?: string }) => {
  const application = await prisma.technicianApplication.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!application) {
    throw new ApiError(404, 'Technician application not found');
  }

  if (application.status !== 'PENDING') {
    throw new ApiError(409, `Application is already ${application.status}`);
  }

  const applicant = application.user;
  if (
    applicant.role !== 'CUSTOMER' ||
    applicant.status !== 'ACTIVE' ||
    applicant.deletedAt !== null
  ) {
    throw new ApiError(409, 'Applicant account is not eligible');
  }

  const premium = await getPremiumStatus(applicant.id);
  if (premium.isPremium) {
    throw new ApiError(409, 'Applicant has an active premium subscription');
  }

  const activeJob = await prisma.workOrder.findFirst({
    where: {
      customerId: applicant.id,
      deletedAt: null,
      status: { notIn: ['CLOSED', 'CANCELLED'] },
    },
  });

  const activeRequest = await prisma.serviceRequest.findFirst({
    where: {
      customerId: applicant.id,
      deletedAt: null,
      status: 'SUBMITTED',
    },
  });

  if (activeJob || activeRequest) {
    throw new ApiError(409, 'Applicant has unfinished service requests or jobs');
  }

  const otp = generateOneTimePassword();
  const passwordHash = await hashPassword(otp);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: applicant.id },
      data: {
        passwordHash,
        mustChangePassword: true,
        oneTimePasswordExpiresAt: expiresAt,
      },
    });

    await tx.refreshToken.updateMany({
      where: { userId: applicant.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    await tx.technicianApplication.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedById: admin.id,
        reviewedAt: new Date(),
        rejectionReason: null,
      },
    });

    await createNotification(
      {
        userId: applicant.id,
        type: 'TECHNICIAN_APPLICATION_APPROVED',
        title: 'Technician application approved',
        message:
          'Your technician application has been approved. Please check your email for login credentials.',
      },
      tx,
    );

    await writeAuditLog(tx, {
      actorId: admin.id,
      action: 'TECHNICIAN_APPLICATION_APPROVED',
      entity: 'TechnicianApplication',
      entityId: application.id,
      ipAddress: admin.ip,
    });
  });

  const emailContent = buildCredentialsEmail({
    name: applicant.name,
    email: applicant.email,
    oneTimePassword: otp,
    expiresAt,
    isResend: false,
  });

  const emailSent = await sendMail({
    to: applicant.email,
    ...emailContent,
  });

  return {
    application: {
      id: application.id,
      status: 'APPROVED' as ApplicationStatus,
    },
    emailSent,
  };
};

export const rejectApplication = async (
  id: string,
  admin: { id: string; ip?: string },
  reason: string,
) => {
  const application = await prisma.technicianApplication.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!application) {
    throw new ApiError(404, 'Technician application not found');
  }

  if (application.status !== 'PENDING') {
    throw new ApiError(409, `Application is already ${application.status}`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.technicianApplication.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        reviewedById: admin.id,
        reviewedAt: new Date(),
      },
    });

    await createNotification(
      {
        userId: application.userId,
        type: 'TECHNICIAN_APPLICATION_REJECTED',
        title: 'Technician application rejected',
        message: `Your technician application was not approved: ${reason}`,
      },
      tx,
    );

    await writeAuditLog(tx, {
      actorId: admin.id,
      action: 'TECHNICIAN_APPLICATION_REJECTED',
      entity: 'TechnicianApplication',
      entityId: application.id,
      newValues: { reason },
      ipAddress: admin.ip,
    });
  });

  const emailContent = buildRejectionEmail({
    name: application.user.name,
    reason,
  });

  const emailSent = await sendMail({
    to: application.user.email,
    ...emailContent,
  });

  return {
    application: {
      id: application.id,
      status: 'REJECTED' as ApplicationStatus,
    },
    emailSent,
  };
};

export const resendCredentials = async (id: string, admin?: { id: string; ip?: string }) => {
  const application = await prisma.technicianApplication.findUnique({
    where: { id },
    include: { user: true },
  });

  if (!application) {
    throw new ApiError(404, 'Technician application not found');
  }

  if (application.status !== 'APPROVED' || !application.user.mustChangePassword) {
    throw new ApiError(
      409,
      'Technician account is already activated or the application is not approved',
    );
  }

  const otp = generateOneTimePassword();
  const passwordHash = await hashPassword(otp);
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: application.userId },
      data: {
        passwordHash,
        mustChangePassword: true,
        oneTimePasswordExpiresAt: expiresAt,
      },
    });

    await tx.refreshToken.updateMany({
      where: { userId: application.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (admin) {
      await writeAuditLog(tx, {
        actorId: admin.id,
        action: 'TECHNICIAN_CREDENTIALS_RESENT',
        entity: 'TechnicianApplication',
        entityId: application.id,
        ipAddress: admin.ip,
      });
    }
  });

  const emailContent = buildCredentialsEmail({
    name: application.user.name,
    email: application.user.email,
    oneTimePassword: otp,
    expiresAt,
    isResend: true,
  });

  const emailSent = await sendMail({
    to: application.user.email,
    ...emailContent,
  });

  return { emailSent };
};
