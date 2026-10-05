import app from './app';
import { env } from './config/env';
import { startAutoCloseJob } from './jobs/auto-close.job';

app.listen(env.PORT, () => {
  console.log(`Server is running on http://localhost:${env.PORT}`);
  startAutoCloseJob();
});
