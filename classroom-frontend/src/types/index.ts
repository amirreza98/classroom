export type Subject = {
    id: number;
    name: string;
    code: string;
    description: string;
    price?: string;
    department?: Department;
    departmentId?: number;
    createdAt?: string;
    updatedAt?: string;
};

export type ListResponse<T = unknown> = {
    data?: T[];
    pagination?: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
};

export type CreateResponse<T = unknown> = {
    data?: T;
};

export type GetOneResponse<T = unknown> = {
    data?: T;
};

declare global {
    interface CloudinaryUploadWidgetResults {
        event: string;
        info: {
            secure_url: string;
            public_id: string;
            delete_token?: string;
            resource_type: string;
            original_filename: string;
        };
    }

    interface CloudinaryWidget {
        open: () => void;
    }

    interface Window {
        cloudinary?: {
            createUploadWidget: (
                options: Record<string, unknown>,
                callback: (
                    error: unknown,
                    result: CloudinaryUploadWidgetResults
                ) => void
            ) => CloudinaryWidget;
        };
    }
}

export interface UploadWidgetValue {
    url: string;
    publicId: string;
}

export interface UploadWidgetProps {
    value?: UploadWidgetValue | null;
    onChange?: (value: UploadWidgetValue | null) => void;
    disabled?: boolean;
}

export enum UserRole {
    STUDENT = "student",
    TEACHER = "teacher",
    ADMIN = "admin",
}

export type User = {
    id: string;
    createdAt: string;
    updatedAt: string;
    email: string;
    name: string;
    role: UserRole;
    image?: string;
    imageCldPubId?: string;
    emailVerified?: boolean;
};

export type Schedule = {
    day: string;
    startTime: string;
    endTime: string;
};

export type Department = {
    id: number;
    code: string;
    name: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
};

export type ClassDetails = {
    id: number;
    name: string;
    description: string;
    status: "active" | "inactive" | "archived";
    capacity: number;
    bannerUrl?: string;
    bannerCldPubId?: string;
    subject?: Subject;
    teacher?: User;
    department?: Department;
    schedules?: Schedule[];
    inviteCode?: string;
    subjectId?: number;
    teacherId?: string;
    createdAt?: string;
    updatedAt?: string;
};

export type Enrollment = {
    id: number;
    studentId: string;
    classId: number;
    paymentStatus?: 'free' | 'pending' | 'paid' | 'failed';
    student?: User;
    createdAt?: string;
    updatedAt?: string;
};

export type Payment = {
    id: number;
    enrollmentId: number;
    studentId: string;
    stripeSessionId: string;
    amount: string;
    currency: string;
    status: 'pending' | 'paid' | 'failed';
    createdAt: string;
    class?: { id: number; name: string };
    subject?: { id: number; name: string; price: string };
};

export type ChatMessage = {
    id: number;
    subjectId: number;
    userId: string;
    userName?: string;
    userImage?: string;
    content: string;
    createdAt: string;
};

export type StudentAnalyticsStats = {
    studentId: string;
    stats: Record<string, number>;
};

export type StudentEnrolledClass = {
    enrollmentId: number;
    paymentStatus: string;
    classId: number;
    className: string;
    classStatus: string;
    classDescription?: string;
    classCapacity: number;
    schedules?: { day: string; startTime: string; endTime: string }[];
    subjectId: number;
    subjectName: string;
    subjectCode: string;
    subjectPrice: string;
    teacherName?: string;
    teacherImage?: string;
};

export type SignUpPayload = {
    email: string;
    name: string;
    password: string;
    image?: string;
    imageCldPubId?: string;
    role: UserRole;
};

export type DashboardStats = {
    totalUsers: number;
    totalClasses: number;
    totalSubjects: number;
    totalDepartments: number;
    totalEnrollments: number;
    activeClasses: number;
    totalStudents: number;
    totalTeachers: number;
};

export type ChartDataPoint = {
    month?: string;
    count: number;
    department?: string;
    status?: string;
    role?: string;
    [key: string]: unknown;
};
