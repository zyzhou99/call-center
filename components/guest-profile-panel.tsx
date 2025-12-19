"use client";

import { useState, useEffect } from 'react';
import { GuestProfile } from '@/types';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/language-context';
import { Phone, Edit2, Check, X } from 'lucide-react';

interface GuestProfilePanelProps {
  profile: GuestProfile | null;
  onCloseConversation: () => void;
}

const NOTES_STORAGE_KEY = 'hotel_call_center_notes';

export function GuestProfilePanel({ profile }: GuestProfilePanelProps) {
  const { t } = useLanguage();
  const [notesState, setNotesState] = useState<Record<string, string>>({});
  const [editingNotes, setEditingNotes] = useState(false);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(NOTES_STORAGE_KEY);
    if (stored) {
      try {
        setNotesState(JSON.parse(stored));
      } catch (e) {
        console.error('Failed to parse notes from localStorage');
      }
    }
  }, []);

  useEffect(() => {
    if (profile && !editingNotes) {
      const currentNotes = notesState[profile.conversationId] || profile.notes;
      setEditText(currentNotes);
    }
  }, [profile, notesState, editingNotes]);

  if (!profile) {
    return null;
  }

  const initials = profile.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const vipTierColors: Record<string, string> = {
    Red: '#DC2626',
    Platinum: '#71717A',
    Black: '#18181B',
    Gold: '#CA8A04',
    Diamond: '#3B82F6',
    Chairman: '#7C3AED',
  };

  const tierColor = vipTierColors[profile.vipTier] || '#CA8A04';

  const currentNotes = notesState[profile.conversationId] || profile.notes;

  const handleEditNotes = () => {
    setEditText(currentNotes);
    setEditingNotes(true);
  };

  const handleSaveNotes = () => {
    const updated = {
      ...notesState,
      [profile.conversationId]: editText,
    };
    setNotesState(updated);
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(updated));
    setEditingNotes(false);
  };

  const handleCancelEdit = () => {
    setEditText(currentNotes);
    setEditingNotes(false);
  };

  return (
    <div className="w-80 bg-white flex flex-col overflow-y-auto" style={{ borderLeft: '1px solid var(--divider)' }}>
      <div className="p-6">
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 rounded-full flex items-center justify-center text-2xl font-medium mb-3" style={{ backgroundColor: 'var(--avatar-bg)', color: 'var(--accent)' }}>
            {initials}
          </div>
          <h2 className="text-xl font-semibold text-center" style={{ color: 'var(--text-primary)' }}>{profile.name}</h2>
          <div className="flex items-center space-x-2 mt-2">
            <span
              className="px-2.5 py-0.5 text-xs font-medium rounded-full text-white"
              style={{ backgroundColor: tierColor }}
            >
              {profile.vipTier}
            </span>
          </div>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {t('room')} {profile.room}
          </p>
        </div>

        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--accent)' }}>
            {t('guestDetails.title')}
          </h3>
          <GuestDetailsTable profile={profile} />
        </div>

        <div className="mb-6">
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--accent)' }}>
            {t('guestDetails.notes')}
          </h3>
          <NotesCard
            notes={currentNotes}
            editing={editingNotes}
            editText={editText}
            onEditTextChange={setEditText}
            onEdit={handleEditNotes}
            onSave={handleSaveNotes}
            onCancel={handleCancelEdit}
          />
        </div>

        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--accent)' }}>
            {t('quickActions.title')}
          </h3>
          <Button
            variant="outline"
            className="w-full"
            style={{ borderColor: 'var(--divider)', color: 'var(--text-primary)' }}
          >
            <Phone className="w-4 h-4 mr-2" />
            {t('quickActions.callGuest')}
          </Button>
        </div>
      </div>
    </div>
  );
}

interface GuestDetailsTableProps {
  profile: GuestProfile;
}

function GuestDetailsTable({ profile }: GuestDetailsTableProps) {
  const { t } = useLanguage();

  const details = [
    { label: t('guestDetails.preferredName'), value: profile.preferredName },
    { label: t('guestDetails.vipNumber'), value: profile.vipNumber },
    { label: t('guestDetails.checkIn'), value: profile.checkInDate },
    { label: t('guestDetails.checkOut'), value: profile.checkOutDate },
    { label: t('guestDetails.status'), value: profile.statusLabel, highlight: true },
    { label: t('guestDetails.segment'), value: profile.segment },
  ];

  return (
    <div className="space-y-3">
      {details.map((detail, index) => (
        <div key={index} className="flex justify-between items-start text-sm">
          <span style={{ color: 'var(--text-secondary)' }}>{detail.label}</span>
          <span
            className="font-medium text-right"
            style={{
              color: detail.highlight ? '#10B981' : 'var(--text-primary)',
              maxWidth: '60%',
            }}
          >
            {detail.value}
          </span>
        </div>
      ))}
    </div>
  );
}

interface NotesCardProps {
  notes: string;
  editing: boolean;
  editText: string;
  onEditTextChange: (text: string) => void;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

function NotesCard({ notes, editing, editText, onEditTextChange, onEdit, onSave, onCancel }: NotesCardProps) {
  const { t } = useLanguage();

  if (editing) {
    return (
      <div className="relative rounded-lg p-3" style={{ backgroundColor: 'var(--bg)' }}>
        <textarea
          value={editText}
          onChange={(e) => onEditTextChange(e.target.value)}
          className="w-full text-xs bg-transparent resize-none focus:outline-none"
          style={{ color: 'var(--text-primary)', lineHeight: '1.6', minHeight: '100px' }}
        />
        <div className="flex items-center justify-end space-x-2 mt-2">
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title={t('notes.cancel')}
          >
            <X className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <button
            onClick={onSave}
            className="p-1.5 hover:bg-gray-200 rounded transition-colors"
            title={t('notes.save')}
          >
            <Check className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative rounded-lg p-3" style={{ backgroundColor: 'var(--bg)' }}>
      <div className="text-xs pr-6" style={{ color: 'var(--text-primary)', lineHeight: '1.6' }}>
        {notes}
      </div>
      <button
        onClick={onEdit}
        className="absolute bottom-2 right-2 p-1.5 hover:bg-gray-200 rounded transition-colors"
        title={t('notes.edit')}
      >
        <Edit2 className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
      </button>
    </div>
  );
}
