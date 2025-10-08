import axios from 'axios';

export interface ICompany {
    id: number;
    company_name: string;
    liked: boolean;
}

export interface ICollection {
    id: string;
    collection_name: string;
    companies: ICompany[];
    total: number;
}

export interface ICompanyBatchResponse {
    companies: ICompany[];
}

export interface IMoveCompaniesRequest {
    company_ids: number[];
    target_collection_id: string;
}

export interface IMoveCompaniesResponse {
    success: boolean;
    message: string;
    companies_moved: number;
    estimated_completion_time: string;
}

export interface IJobStatus {
    id: string;
    name: string;
    state: string;
    done: number;
    total: number;
    progress: number;
    created_at: string;
    error_message?: string;
}

export interface IAddCompaniesRequest {
    select_all: boolean;
    source_collection_id?: string;
    company_ids?: number[];
    filter?: any;
}

export interface IAddCompaniesResponse {
    job_id: string;
    message: string;
    estimated_time: string;
}

export interface IDryRunResponse {
    estimated_new_companies: number;
    already_existing: number;
    estimated_time: string;
}

const BASE_URL = 'http://localhost:8000';

export async function getCompanies(offset?: number, limit?: number): Promise<ICompanyBatchResponse> {
    try {
        const response = await axios.get(`${BASE_URL}/companies`, {
            params: {
                offset,
                limit,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching companies:', error);
        throw error;
    }
}

export async function getCollectionsById(id: string, offset?: number, limit?: number): Promise<ICollection> {
    try {
        const response = await axios.get(`${BASE_URL}/collections/${id}`, {
            params: {
                offset,
                limit,
            },
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching companies:', error);
        throw error;
    }
}

export async function getCollectionsMetadata(): Promise<ICollection[]> {
    try {
        const response = await axios.get(`${BASE_URL}/collections`);
        return response.data;
    } catch (error) {
        console.error('Error fetching companies:', error);
        throw error;
    }
}

export async function moveCompaniesToCollection(
    sourceCollectionId: string,
    request: IMoveCompaniesRequest
): Promise<IMoveCompaniesResponse> {
    try {
        const response = await axios.post(
            `${BASE_URL}/collections/${sourceCollectionId}/move-companies`,
            request
        );
        return response.data;
    } catch (error) {
        console.error('Error moving companies:', error);
        throw error;
    }
}

export async function moveAllCompaniesToCollection(
    sourceCollectionId: string,
    targetCollectionId: string
): Promise<IMoveCompaniesResponse> {
    try {
        const response = await axios.post(
            `${BASE_URL}/collections/${sourceCollectionId}/move-all`,
            null,
            {
                params: {
                    target_collection_id: targetCollectionId
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error('Error moving all companies:', error);
        throw error;
    }
}

// Advanced job management API functions
export async function addCompaniesToCollection(
    targetCollectionId: string,
    request: IAddCompaniesRequest,
    idempotencyKey?: string
): Promise<IAddCompaniesResponse> {
    try {
        const headers: any = {
            'Content-Type': 'application/json'
        };
        if (idempotencyKey) {
            headers['X-Idempotency-Key'] = idempotencyKey;
        }

        const response = await axios.post(
            `${BASE_URL}/jobs/collections/${targetCollectionId}/add`,
            request,
            { headers }
        );
        return response.data;
    } catch (error) {
        console.error('Error adding companies:', error);
        throw error;
    }
}

export async function getJobStatus(jobId: string): Promise<IJobStatus> {
    try {
        const response = await axios.get(`${BASE_URL}/jobs/${jobId}`);
        return response.data;
    } catch (error) {
        console.error('Error fetching job status:', error);
        throw error;
    }
}

export async function getRecentJobs(limit: number = 20): Promise<IJobStatus[]> {
    try {
        const response = await axios.get(`${BASE_URL}/jobs/`, {
            params: { limit }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching recent jobs:', error);
        throw error;
    }
}

export async function cancelJob(jobId: string): Promise<void> {
    try {
        await axios.post(`${BASE_URL}/jobs/${jobId}/cancel`);
    } catch (error) {
        console.error('Error cancelling job:', error);
        throw error;
    }
}

export async function undoLastOperation(collectionId: string): Promise<void> {
    try {
        await axios.post(`${BASE_URL}/jobs/collections/${collectionId}/undo`);
    } catch (error) {
        console.error('Error undoing operation:', error);
        throw error;
    }
}

export async function dryRunAddOperation(
    collectionId: string,
    request: IAddCompaniesRequest
): Promise<IDryRunResponse> {
    try {
        const response = await axios.get(
            `${BASE_URL}/jobs/collections/${collectionId}/dry-run`,
            { params: request }
        );
        return response.data;
    } catch (error) {
        console.error('Error running dry run:', error);
        throw error;
    }
}