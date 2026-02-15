'use client';

import AuthorSidebar from './AuthorSidebar';
import type { AuthorSummary } from '@/types';

interface MobileSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  authors: AuthorSummary[];
  selectedAuthor: AuthorSummary | null;
  onAuthorSelect: (author: AuthorSummary) => void;
  onScan: () => void;
  onUpload: (files: FileList) => Promise<void>;
  onVideoUploadClick: () => void;
  isScanning: boolean;
  isUploading: boolean;
  inProgressCount: number;
  isInProgressSelected: boolean;
  onInProgressSelect: () => void;
}

export default function MobileSidebar({
  isOpen,
  onClose,
  ...sidebarProps
}: MobileSidebarProps) {
  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 xl:hidden"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={`
          fixed left-0 top-0 bottom-0
          w-80 max-w-[85vw]
          bg-gray-900
          transform transition-transform duration-300 ease-in-out
          z-50 xl:hidden
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="h-full overflow-y-auto">
          <AuthorSidebar {...sidebarProps} />
        </div>
      </div>
    </>
  );
}
