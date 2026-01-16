// src/pages/FriendsPage.jsx

import React, { useState, useMemo } from 'react';
import { useSession } from '@supabase/auth-helpers-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import {
  searchUsers,
  getFriendships,
  addFriend,
  respondToFriendRequest,
  removeFriendship,
  getTutorRelationships,
  acceptTutorInvite,
  removeTutorRelationship
} from '../api/supabaseAPI';
import Loader from '../components/Loader';
import '../styles/FriendsPage.css';

// --- 子元件 ---
const Avatar = ({ username }) => {
  const initial = username ? username.charAt(0).toUpperCase() : '?';
  return <div className="avatar">{initial}</div>;
};

// --- 主元件 ---
export default function FriendsPage() {
  const { t } = useTranslation();
  const session = useSession();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });
  const [hasSearched, setHasSearched] = useState(false);

  // --- 數據獲取 (React Query) ---
  const { data: friendships, isLoading: isLoadingFriendships } = useQuery({
    queryKey: ['friendships', userId],
    queryFn: () => getFriendships(userId),
    enabled: !!userId,
  });

  const { data: tutorRelationships, isLoading: isLoadingTutors } = useQuery({
    queryKey: ['tutorRelationships', userId],
    queryFn: () => getTutorRelationships(userId),
    enabled: !!userId,
  });

  const { data: searchResults, refetch: refetchSearch, isFetching: isSearching } = useQuery({
    queryKey: ['userSearch', searchTerm],
    queryFn: () => searchUsers(searchTerm, userId),
    enabled: false,
  });

  // --- 數據處理 (useMemo) ---
  const { myFriends, friendRequests } = useMemo(() => {
    if (!friendships) {
        return { myFriends: [], friendRequests: [] };
    }
    const currentFriends = [];
    const incomingRequests = [];
    friendships.forEach(fs => {
        if (!fs || !fs.status) return;
        if (fs.status === 'accepted') {
            const friendProfile = fs.user_one_id === userId ? fs.user_two : fs.user_one;
            if (friendProfile) {
              currentFriends.push(friendProfile);
            }
        } 
        else if (fs.status === 'pending' && fs.action_user_id !== userId) {
            const requestorProfile = fs.user_one_id === fs.action_user_id ? fs.user_one : fs.user_two;
            if (requestorProfile) incomingRequests.push(requestorProfile);
        }
    });
    return { myFriends: currentFriends, friendRequests: incomingRequests };
  }, [friendships, userId]);

  const { myTutors, tutorInvites } = useMemo(() => {
    if (!tutorRelationships) {
      return { myTutors: [], tutorInvites: [] };
    }
    const accepted = [];
    const pending = [];
    tutorRelationships.forEach(tr => {
      if (!tr || !tr.status) return;
      if (tr.status === 'accepted') {
        accepted.push(tr);
      } else if (tr.status === 'pending') {
        pending.push(tr);
      }
    });
    return { myTutors: accepted, tutorInvites: pending };
  }, [tutorRelationships]);

   // --- 異步操作 (Mutations) ---
  const mutationOptions = {
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['friendships', userId] });
      queryClient.invalidateQueries({ queryKey: ['tutorRelationships', userId] });
      setMessage({ text: t('friendsPage.actionSuccess', 'Action successful!'), type: 'success' });
      setTimeout(() => setMessage({ text: '', type: '' }), 2000);
    },
    onError: (error) => {
      setMessage({ text: error.message, type: 'error' });
      setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    },
  };

  const addFriendMutation = useMutation({
    mutationFn: (receiverId) => addFriend(userId, receiverId),
    ...mutationOptions,
  });

  const respondRequestMutation = useMutation({
    mutationFn: ({ actionUserId, status }) => respondToFriendRequest(actionUserId, userId, status),
    ...mutationOptions,
  });

  const removeFriendMutation = useMutation({
    mutationFn: (friendId) => removeFriendship(userId, friendId),
    ...mutationOptions,
  });

  const acceptTutorMutation = useMutation({
    mutationFn: (relationshipId) => acceptTutorInvite(relationshipId),
    ...mutationOptions,
  });

  const removeTutorMutation = useMutation({
    mutationFn: (relationshipId) => removeTutorRelationship(relationshipId),
    ...mutationOptions,
  });

  // --- 事件處理 ---
  const handleSearch = (e) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setHasSearched(true);
      refetchSearch();
    }
  };

  // --- 渲染邏輯 ---
  if (isLoadingFriendships || isLoadingTutors) {
    return <main className="friends-page-container"><Loader /></main>;
  }

  return (
    <main className="friends-page-container">
      <div className="friends-content-wrapper">
        {/* 左側區塊 */}
        <div className="main-panel">
          {/* 搜尋區 */}
          <section className="card">
            <h2 className="card-title">{t('friendsPage.findFriends', 'Find Friends')}</h2>
            <form className="search-form" onSubmit={handleSearch}>
              <input
                type="text"
                placeholder={t('friendsPage.searchPlaceholder', 'Search by username...')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="btn btn-primary" disabled={isSearching}>
                {t('friendsPage.searchButton', 'Search')}
              </button>
            </form>
            
            {hasSearched && (
              <div className="search-results-container">
                {isSearching ? (
                  <Loader />
                ) : (
                  <ul className="search-results-list">
                    {searchResults && searchResults.length > 0 ? (
                      searchResults.map(user => (
                        <li key={user.id} className="list-item">
                          <div className="user-info">
                            <Avatar username={user.username} />
                            <div className="user-details">
                              <span className="user-name">{user.username}</span>
                              <span className="user-level">Level: {user.settings?.sug_lvl || 'N/A'}</span>
                            </div>
                          </div>
                          <button
                            className="btn btn-add"
                            onClick={() => addFriendMutation.mutate(user.id)}
                            disabled={addFriendMutation.isLoading}
                          >
                            {t('friendsPage.addButton', 'Add Friend')}
                          </button>
                        </li>
                      ))
                    ) : (
                      <p className="no-results-message">{t('friendsPage.noUsersFound', 'No users found')}</p>
                    )}
                  </ul>
                )}
              </div>
            )}
          </section>

          {/* 我的好友列表 */}
          <section className="card">
            <h2 className="card-title">{t('friendsPage.myFriends', 'My Friends')} ({myFriends.length})</h2>
            {myFriends.length > 0 ? (
              <ul className="friends-list">
                {myFriends.map(friend => (
                  <li key={friend.id} className="list-item">
                    <div className="user-info">
                      <Avatar username={friend.username} />
                      <div className="user-details">
                        <span className="user-name">{friend.username}</span>
                        <span className="user-level">Level: {friend.settings?.sug_lvl || 'N/A'}</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-remove"
                      onClick={() => removeFriendMutation.mutate(friend.id)}
                      disabled={removeFriendMutation.isLoading}
                    >
                      {t('friendsPage.remove', 'Remove')}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-message">{t('friendsPage.noFriends', 'No friends yet')}</p>
            )}
          </section>

          {/* 我的教師 */}
          <section className="card">
            <h2 className="card-title">{t('friendsPage.myTutor', 'My Tutor')} ({myTutors.length})</h2>
            {myTutors.length > 0 ? (
              <ul className="tutors-list">
                {myTutors.map(relationship => (
                  <li key={relationship.id} className="list-item">
                    <div className="user-info">
                      <Avatar username={relationship.tutor.display_name || relationship.tutor.full_name} />
                      <div className="user-details">
                        <span className="user-name">{relationship.tutor.display_name || relationship.tutor.full_name}</span>
                        <span className="user-level">{relationship.tutor.headline}</span>
                      </div>
                    </div>
                    <button
                      className="btn btn-remove"
                      onClick={() => removeTutorMutation.mutate(relationship.id)}
                      disabled={removeTutorMutation.isLoading}
                    >
                      {t('friendsPage.removeTutor', 'Remove Tutor')}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-message">{t('friendsPage.noTutor', 'No tutor assigned yet')}</p>
            )}
          </section>
        </div>

        {/* 右側區塊 */}
        <div className="side-panel">
          {/* 好友請求 */}
          <section className="card">
            <h2 className="card-title">{t('friendsPage.friendRequests', 'Friend Requests')} ({friendRequests.length})</h2>
            {friendRequests.length > 0 ? (
              <ul className="requests-list">
                {friendRequests.map(requestor => (
                  <li key={requestor.id} className="request-item">
                    <div className="user-info">
                      <Avatar username={requestor.username} />
                      <span className="user-name">{requestor.username}</span>
                    </div>
                    <div className="request-actions">
                      <button
                        className="btn btn-accept"
                        onClick={() => respondRequestMutation.mutate({ actionUserId: requestor.id, status: 'accepted' })}
                        disabled={respondRequestMutation.isLoading}
                      >
                        {t('friendsPage.accept', 'Accept')}
                      </button>
                      <button
                        className="btn btn-decline"
                        onClick={() => respondRequestMutation.mutate({ actionUserId: requestor.id, status: 'rejected' })}
                        disabled={respondRequestMutation.isLoading}
                      >
                        {t('friendsPage.decline', 'Decline')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-message">{t('friendsPage.noRequests', 'No pending requests')}</p>
            )}
          </section>

          {/* 教師邀請 */}
          <section className="card">
            <h2 className="card-title">{t('friendsPage.tutorInvites', 'Tutor Invites')} ({tutorInvites.length})</h2>
            {tutorInvites.length > 0 ? (
              <ul className="requests-list">
                {tutorInvites.map(relationship => (
                  <li key={relationship.id} className="request-item">
                    <div className="user-info">
                      <Avatar username={relationship.tutor.display_name || relationship.tutor.full_name} />
                      <div className="user-details">
                        <span className="user-name">{relationship.tutor.display_name || relationship.tutor.full_name}</span>
                      </div>
                    </div>
                    <div className="request-actions">
                      <button
                        className="btn btn-accept"
                        onClick={() => acceptTutorMutation.mutate(relationship.id)}
                        disabled={acceptTutorMutation.isLoading}
                      >
                        {t('friendsPage.accept', 'Accept')}
                      </button>
                      <button
                        className="btn btn-decline"
                        onClick={() => removeTutorMutation.mutate(relationship.id)}
                        disabled={removeTutorMutation.isLoading}
                      >
                        {t('friendsPage.decline', 'Decline')}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty-message">{t('friendsPage.noInvites', 'No pending invites')}</p>
            )}
          </section>
        </div>
      </div>
      {message.text && <div className={`toast-message ${message.type}`}>{message.text}</div>}
    </main>
  );
}
