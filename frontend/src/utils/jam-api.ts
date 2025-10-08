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