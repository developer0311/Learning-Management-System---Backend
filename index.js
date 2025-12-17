import dotenv from "dotenv";
import app from './app.js';

dotenv.config();

// Run app.listen() only when NOT on Vercel
if (!process.env.VERCEL) {
    const PORT = process.env.SERVER_PORT || 3000;
    app.listen(PORT, () => {
        console.log(`App is running on port ${PORT}`);
    });
}

// Export for Vercel serverless
export default app;
