import { api } from './api';
import type { User, FriendRequest } from '../types';
import { USE_MOCK_BACKEND } from '../config/backend';

interface FriendRequestsResponse {
    requests?: FriendRequest[];
}

export type FriendRequestDecision = 'ACCEPT' | 'DECLINE';

export async function searchUsers(query: string): Promise<User[]> {
    if (USE_MOCK_BACKEND) {
        const normalizedQuery = query.trim().toLowerCase();
        const rawUsers = localStorage.getItem('mock_auth_users');
        const users = rawUsers ? JSON.parse(rawUsers) as User[] : [];

        if (!normalizedQuery) {
            return [];
        }

        return users
            .filter(user => (
                user.username.toLowerCase().includes(normalizedQuery) ||
                user.email.toLowerCase().includes(normalizedQuery)
            ))
            .map(({ id, username, email, avatarUrl }) => ({ id, username, email, avatarUrl }));
    }

    const response = await api.get<User[]>('/users/search', {
        params: { q: query },
    });

    return response.data;
}

export async function getFriends(): Promise<User[]> {
    if (USE_MOCK_BACKEND) {
        return [];
    }

    const response = await api.get<User[]>('/friends');

    return response.data;
}

export async function getFriendRequests(): Promise<FriendRequest[]> {
    if (USE_MOCK_BACKEND) {
        return [];
    }

    const response = await api.get<FriendRequestsResponse>('/friends/requests');

    return response.data.requests ?? [];
}

export async function sendFriendRequest(toUserId: number): Promise<FriendRequest | null> {
    if (USE_MOCK_BACKEND) {
        return null;
    }

    const response = await api.post<FriendRequest>(
        '/friends/requests',
        { userId: toUserId },
    );

    return response.data;
}

export async function updateFriendRequestStatus(
    requestId: number,
    decision: FriendRequestDecision,
): Promise<void> {
    if (USE_MOCK_BACKEND) {
        return;
    }

    const status = decision === 'ACCEPT' ? 'accepted' : 'refused';

    await api.put(`/friends/requests/${requestId}`, { status });
}

export async function removeFriend(friendId: number): Promise<void> {
    if (USE_MOCK_BACKEND) {
        return;
    }

    await api.delete(`/friends/${friendId}`);
}

export async function getFriendPetCustomizations(userId: number) {
    if (USE_MOCK_BACKEND) {
        return null;
    }

    const response = await api.get(`/pets?q=${userId}`);
    return response.data;
}
