"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';

export type Language = 'en' | 'zh-Hant';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    'search.placeholder': 'Search contacts...',
    'guestDetails.title': 'GUEST DETAILS',
    'guestDetails.checkIn': 'Check-in Date',
    'guestDetails.checkOut': 'Check-out Date',
    'guestDetails.segment': 'Segment',
    'guestDetails.status': 'Status',
    'guestDetails.preferredName': 'Preferred Name',
    'guestDetails.vipNumber': 'VIP Number',
    'guestDetails.notes': 'Notes',
    'quickActions.title': 'QUICK ACTIONS',
    'quickActions.callGuest': 'Call Guest',
    'composer.placeholder': 'Type a message',
    'composer.helperText': 'Press Enter to send • Ctrl+Enter for internal note',
    'room': 'Room',
    'notes.edit': 'Edit',
    'notes.save': 'Save',
    'notes.cancel': 'Cancel',
  },
  'zh-Hant': {
    'search.placeholder': '搜尋聯絡人...',
    'guestDetails.title': '賓客資料',
    'guestDetails.checkIn': '入住日期',
    'guestDetails.checkOut': '退房日期',
    'guestDetails.segment': '類別',
    'guestDetails.status': '狀態',
    'guestDetails.preferredName': '偏好稱呼',
    'guestDetails.vipNumber': '貴賓編號',
    'guestDetails.notes': '備註',
    'quickActions.title': '快捷操作',
    'quickActions.callGuest': '致電賓客',
    'composer.placeholder': '輸入訊息',
    'composer.helperText': '按 Enter 發送 • Ctrl+Enter 新增內部備註',
    'room': '房間',
    'notes.edit': '編輯',
    'notes.save': '儲存',
    'notes.cancel': '取消',
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'hotel_call_center_language';

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    const storedLanguage = localStorage.getItem(STORAGE_KEY) as Language;
    if (storedLanguage && (storedLanguage === 'en' || storedLanguage === 'zh-Hant')) {
      setLanguageState(storedLanguage);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  };

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
