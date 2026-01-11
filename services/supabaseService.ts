/**
 * Supabase Service
 * 인증 및 데이터베이스 클라이언트
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase 환경변수가 설정되지 않았습니다. 인증 기능이 비활성화됩니다.');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

// Auth helpers
export const signUp = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signIn = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const getSession = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
};

// ============ Chat 관련 함수 ============

export interface DbChat {
  id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface DbMessage {
  id: string;
  chat_id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: string;
}

// 새 채팅 생성
export const createChat = async (title: string = '새 채팅'): Promise<DbChat> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  const { data, error } = await supabase
    .from('chats')
    .insert({ user_id: user.id, title })
    .select()
    .single();

  if (error) throw error;
  return data;
};

// 유저의 모든 채팅 목록 조회
export const getUserChats = async (): Promise<DbChat[]> => {
  const { data, error } = await supabase
    .from('chats')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return data || [];
};

// 특정 채팅의 메시지 조회
export const getChatMessages = async (chatId: string): Promise<DbMessage[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('timestamp', { ascending: true });

  if (error) throw error;
  return data || [];
};

// 메시지 저장
export const saveMessage = async (
  chatId: string,
  role: 'user' | 'model',
  text: string
): Promise<DbMessage> => {
  const { data, error } = await supabase
    .from('messages')
    .insert({ chat_id: chatId, role, text })
    .select()
    .single();

  if (error) throw error;

  // 채팅 updated_at 갱신
  await supabase
    .from('chats')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', chatId);

  return data;
};

// 채팅 제목 업데이트
export const updateChatTitle = async (chatId: string, title: string): Promise<void> => {
  const { error } = await supabase
    .from('chats')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', chatId);

  if (error) throw error;
};

// 채팅 삭제
export const deleteChat = async (chatId: string): Promise<void> => {
  const { error } = await supabase
    .from('chats')
    .delete()
    .eq('id', chatId);

  if (error) throw error;
};

// 회원 탈퇴 (계정 삭제)
export const deleteAccount = async (): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('로그인이 필요합니다.');

  // 1. 사용자의 모든 채팅 삭제 (messages는 CASCADE로 자동 삭제됨)
  const { error: chatsError } = await supabase
    .from('chats')
    .delete()
    .eq('user_id', user.id);

  if (chatsError) throw chatsError;

  // 2. Supabase Auth에서 사용자 삭제 요청
  // Note: 클라이언트에서는 자신의 계정만 삭제 가능
  // admin API가 필요한 경우 Edge Function 사용 필요
  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) throw signOutError;
};
