/**
 * ChatSidebar Component
 * 채팅 목록 사이드바 - 이전 채팅 선택/생성/삭제
 */

import React from 'react';
import { MessageSquare, Plus, Trash2, Loader2 } from 'lucide-react';
import { DbChat } from '../services/supabaseService';

interface ChatSidebarProps {
  chats: DbChat[];
  currentChatId: string | null;
  onSelectChat: (chatId: string) => void;
  onNewChat: () => void;
  onDeleteChat: (chatId: string) => void;
  loading: boolean;
  isDemo: boolean;
}

const ChatSidebar: React.FC<ChatSidebarProps> = ({
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  loading,
  isDemo
}) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '오늘';
    if (diffDays === 1) return '어제';
    if (diffDays < 7) return `${diffDays}일 전`;
    return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  };

  if (isDemo) {
    return (
      <div className="p-4 text-center text-slate-500 text-sm">
        <p>로그인하면 채팅 기록이 저장됩니다</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 새 채팅 버튼 */}
      <div className="p-3 border-b border-slate-200">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-all text-sm"
        >
          <Plus size={16} />
          새 채팅
        </button>
      </div>

      {/* 채팅 목록 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="animate-spin text-slate-400" />
          </div>
        ) : chats.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-sm">
            채팅 기록이 없습니다
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {chats.map((chat) => (
              <div
                key={chat.id}
                className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                  currentChatId === chat.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'hover:bg-slate-50 text-slate-600'
                }`}
                onClick={() => onSelectChat(chat.id)}
              >
                <MessageSquare size={16} className="shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{chat.title}</p>
                  <p className="text-[10px] text-slate-400">{formatDate(chat.updated_at)}</p>
                </div>

                {/* 삭제 버튼 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('이 채팅을 삭제하시겠습니까?')) {
                      onDeleteChat(chat.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 rounded-lg text-slate-400 hover:text-red-500 transition-all"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatSidebar;
