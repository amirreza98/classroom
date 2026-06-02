declare global {
    namespace Express {
        interface Request {
            user?: {
                id: string;
                role: "admin" | "teacher" | "student";
                email: string;
            }
        }
    }
}

export {};