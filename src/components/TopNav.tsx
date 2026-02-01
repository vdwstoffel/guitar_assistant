'use client';

import Link from 'next/link';

type Section = 'library' | 'videos' | 'metronome' | 'fretboard';

interface TopNavProps {
  activeSection: Section;
  onSectionChange: (section: Section) => void;
}

export default function TopNav({ activeSection, onSectionChange }: TopNavProps) {
  const sections: { id: Section; label: string; href: string }[] = [
    { id: 'library', label: 'Library', href: '/' },
    { id: 'videos', label: 'Videos', href: '/videos' },
    { id: 'metronome', label: 'Metronome', href: '/metronome' },
    { id: 'fretboard', label: 'Fretboard', href: '/fretboard' },
  ];

  return (
    <nav className="bg-gray-800 border-b border-gray-700 px-4 py-2 flex-shrink-0">
      <div className="flex gap-1">
        {sections.map((section) => (
          <Link
            key={section.id}
            href={section.href}
            onClick={() => onSectionChange(section.id)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeSection === section.id
                ? 'bg-gray-700 text-white'
                : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
            }`}
          >
            {section.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
