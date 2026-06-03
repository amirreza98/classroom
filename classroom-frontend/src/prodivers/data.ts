import { createDataProvider, CreateDataProviderOptions } from "@refinedev/rest";
import { BACKEND_BASE_URL } from "@/constants";
import { getToken } from "@/lib/token";
import { CreateResponse, GetOneResponse, ListResponse } from "@/types";
import { HttpError } from "@refinedev/core";

const buildHttpError = async (response: Response): Promise<HttpError> => {
    let message = 'Request failed.';
    try {
        const payload = (await response.json()) as { message?: string; error?: string };
        if (payload?.message) message = payload.message;
        else if (payload?.error) message = payload.error;
    } catch {
        // Ignore errors
    }
    return { message, statusCode: response.status };
};

if (!BACKEND_BASE_URL)
    throw new Error('BACKEND_BASE_URL is not configured. Please set VITE_BACKEND_BASE_URL in your .env file');

const options: CreateDataProviderOptions = {
    getList: {
        getEndpoint: ({ resource }) => resource,

        buildQueryParams: async ({ resource, pagination, filters }) => {
            const page = pagination?.currentPage ?? 1;
            const pagesize = pagination?.pageSize ?? 10;
            const params: Record<string, string | number> = { page, limit: pagesize };

            filters?.forEach((filter) => {
                const field = 'field' in filter ? filter.field : '';
                const value = String(filter.value);

                if (resource === 'subjects') {
                    if (field === 'department') params.department = value;
                    if (field === 'name' || field === 'code') params.search = value;
                }
                if (resource === 'users') {
                    if (field === 'role') params.role = value;
                    if (field === 'name' || field === 'email') params.search = value;
                }
                if (resource === 'classes') {
                    if (field === 'subject') params.subject = value;
                    if (field === 'teacher') params.teacher = value;
                    if (field === 'name') params.search = value;
                    if (field === 'status') params.status = value;
                }
                if (resource === 'departments') {
                    if (field === 'name') params.search = value;
                }
                if (resource === 'enrollments') {
                    if (field === 'classId') params.classId = value;
                }
                if (field === 'search' || field === 'q') params.search = value;
            });

            return params;
        },

        mapResponse: async (response) => {
            if (!response.ok) throw await buildHttpError(response);
            const payload: ListResponse = await response.clone().json();
            return payload.data ?? [];
        },

        getTotalCount: async (response) => {
            if (!response.ok) throw await buildHttpError(response);
            const payload: ListResponse = await response.clone().json();
            return payload.pagination?.total ?? payload.data?.length ?? 0;
        }
    },

    create: {
        getEndpoint: ({ resource }) => resource,
        buildBodyParams: async ({ variables }) => variables,
        mapResponse: async (response) => {
            const json: CreateResponse = await response.json();
            return json.data ?? [];
        }
    },

    update: {
        getEndpoint: ({ resource, id }) => `${resource}/${id}`,
        getRequestMethod: () => 'put',
        buildBodyParams: async ({ variables }) => variables,
        mapResponse: async (response) => {
            if (!response.ok) throw await buildHttpError(response);
            const json: GetOneResponse = await response.json();
            return json.data ?? null;
        }
    },

    deleteOne: {
        getEndpoint: ({ resource, id }) => `${resource}/${id}`,
        mapResponse: async (response) => {
            if (!response.ok) throw await buildHttpError(response);
            const json: GetOneResponse = await response.json();
            return json.data ?? null;
        }
    },

    getOne: {
        getEndpoint: ({ resource, id }) => `${resource}/${id}`,
        mapResponse: async (response) => {
            if (!response.ok) throw await buildHttpError(response);
            const json: GetOneResponse = await response.json();
            return json.data ?? null;
        }
    }
};

const { dataProvider } = createDataProvider(BACKEND_BASE_URL, options, {
    hooks: {
        beforeRequest: [
            async (request) => {
                const token = await getToken();
                if (token) request.headers.set('Authorization', `Bearer ${token}`);
            },
        ],
    },
});
export { dataProvider };
