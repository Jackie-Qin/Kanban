// VSCode-style file icons with proper colors
interface FileIconProps {
  name: string
  isDirectory: boolean
  isExpanded?: boolean
  className?: string
}

export default function FileIcon({ name, isDirectory, isExpanded, className = 'w-4 h-4' }: FileIconProps) {
  if (isDirectory) {
    return isExpanded ? (
      <svg className={`${className} text-yellow-400`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2z" fillOpacity="0.9" />
        <path d="M5 10h14v8H5z" fill="#1e1e1e" fillOpacity="0.3" />
      </svg>
    ) : (
      <svg className={`${className} text-yellow-400`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v10a2 2 0 01-2 2z" />
      </svg>
    )
  }

  const ext = name.split('.').pop()?.toLowerCase()
  const lowerName = name.toLowerCase()

  // TypeScript
  if (ext === 'ts' || ext === 'tsx') {
    return (
      <svg className={`${className}`} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="2" fill="#3178c6" />
        <path d="M14 10h-4v10h-2v-10h-4v-2h10v2zm-1 4v2h4v-2h-4zm4 4h-4v2h4v-2z" fill="white" />
      </svg>
    )
  }

  // JavaScript
  if (ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') {
    return (
      <svg className={`${className}`} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="2" fill="#f7df1e" />
        <path d="M12 14.5c0 1.93 1.57 3.5 3.5 3.5s3.5-1.57 3.5-3.5c0-1.93-1.57-3.5-3.5-3.5-.62 0-1.2.16-1.7.44v-3.94h3.4v-2h-5.4v7.24c-.68-.46-1.5-.74-2.38-.74-2.35 0-4.25 1.9-4.25 4.25 0 .26.02.52.07.77h2.03c-.07-.25-.1-.5-.1-.77 0-1.24 1.01-2.25 2.25-2.25s2.25 1.01 2.25 2.25z" fill="#000" />
      </svg>
    )
  }

  // Swift
  if (ext === 'swift') {
    return (
      <svg className={className} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="4" fill="#F05138" />
        <path d="M7.13 18.26c3.88 2.43 9.11 1.63 11.63-2.31.36-.56.64-1.14.84-1.73-.47.35-1.01.63-1.58.82-2.14.71-4.52.34-6.39-.88 0 0 3.98-2.42 6.22-6.14-1.95 1.61-5.92 3.86-5.92 3.86-.64-.5-3.71-3.27-4.64-6.88-.34 2.59.46 5.23 2.23 7.24-1.33-.56-2.48-1.47-3.34-2.63.48 1.43 1.3 2.72 2.4 3.77-1.65-.29-3.2-1.03-4.46-2.13.87 2.19 2.71 3.87 5.01 4.46-.89.2-1.81.25-2.72.14.79.81 1.76 1.43 2.72 1.41z" fill="white"/>
      </svg>
    )
  }

  // Kotlin
  if (ext === 'kt' || ext === 'kts') {
    return (
      <svg className={`${className}`} viewBox="0 0 24 24">
        <defs>
          <linearGradient id="kotlin-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7F52FF" />
            <stop offset="100%" stopColor="#E44857" />
          </linearGradient>
        </defs>
        <rect width="24" height="24" rx="2" fill="url(#kotlin-grad)" />
        <path d="M4 20L12 12L4 4H12L20 12L12 20H4Z" fill="white" />
      </svg>
    )
  }

  // JSON
  if (ext === 'json') {
    return (
      <svg className={`${className} text-yellow-300`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 3h2v2H5v5a2 2 0 01-2 2 2 2 0 012 2v5h2v2H5c-1.07-.27-2-.9-2-2v-4a2 2 0 00-2-2H0v-2h1a2 2 0 002-2V5a2 2 0 012-2zm14 0a2 2 0 012 2v4a2 2 0 002 2h1v2h-1a2 2 0 00-2 2v4a2 2 0 01-2 2h-2v-2h2v-5a2 2 0 012-2 2 2 0 01-2-2V5h-2V3h2z" />
      </svg>
    )
  }

  // Markdown
  if (ext === 'md' || ext === 'mdx') {
    return (
      <svg className={`${className} text-blue-400`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M20.56 18H3.44C2.65 18 2 17.37 2 16.59V7.41C2 6.63 2.65 6 3.44 6h17.12c.79 0 1.44.63 1.44 1.41v9.18c0 .78-.65 1.41-1.44 1.41zM6.81 15.19v-3.66l1.92 2.35 1.92-2.35v3.66h1.93V8.81h-1.93l-1.92 2.35-1.92-2.35H4.89v6.38h1.92zM19.69 12h-1.92V8.81h-1.92V12h-1.93l2.89 3.28L19.69 12z" />
      </svg>
    )
  }

  // CSS/SCSS/Sass/Less
  if (ext === 'css' || ext === 'scss' || ext === 'sass' || ext === 'less') {
    const color = ext === 'css' ? '#264de4' : ext === 'scss' || ext === 'sass' ? '#cf649a' : '#1d365d'
    return (
      <svg className={className} viewBox="0 0 24 24">
        <rect width="24" height="24" rx="2" fill={color} />
        <path d="M8 7l-2 10h2l.5-2.5h3L11 17h2l2-10h-2l-1 5h-3l1-5H8z" fill="white" />
      </svg>
    )
  }

  // HTML
  if (ext === 'html' || ext === 'htm') {
    return (
      <svg className={className} viewBox="0 0 24 24">
        <path d="M4 3l1.67 18.4L12 23l6.33-1.6L20 3H4zm13.53 6H8.87l.22 2.5h8.15l-.67 7.33L12 20.17l-4.57-1.33-.33-3.67h2.45l.17 1.87 2.28.62 2.28-.62.23-2.54H7.2L6.47 6h11.06v3z" fill="#e44d26" />
      </svg>
    )
  }

  // Python
  if (ext === 'py' || ext === 'pyw' || ext === 'pyx') {
    return (
      <svg className={className} viewBox="0 0 24 24">
        <path d="M11.9 2c-1.16 0-2.27.1-3.24.28C6.32 2.7 6 3.55 6 4.92v2.15h6v.73H6 4.11c-1.25 0-2.35.75-2.69 2.19-.4 1.65-.41 2.68 0 4.4.3 1.28 1.02 2.19 2.27 2.19h1.47v-1.98c0-1.42 1.23-2.67 2.69-2.67h5.31c1.19 0 2.15-1 2.15-2.2V4.91c0-1.16-1-2.03-2.15-2.26A16.7 16.7 0 0011.9 2zM8.87 4.04c.44 0 .8.36.8.82a.81.81 0 01-.8.81.81.81 0 01-.8-.81c0-.46.36-.82.8-.82z" fill="#3776ab" />
        <path d="M18.33 7.8v1.93c0 1.48-1.27 2.73-2.69 2.73H10.3c-1.17 0-2.1 1.01-2.1 2.2v4.12c0 1.16.98 1.85 2.1 2.19 1.34.4 2.62.48 4.21 0 1.06-.31 2.1-.94 2.1-2.19v-1.64h-4.21v-.54h6.32c1.24 0 1.7-.87 2.1-2.17.4-1.34.38-2.63 0-4.39-.27-1.27-.8-2.19-2.05-2.19h-1.54zm-2.38 9.14c.44 0 .8.35.8.81 0 .45-.36.82-.8.82a.81.81 0 01-.8-.82c0-.46.36-.81.8-.81z" fill="#ffd43b" />
      </svg>
    )
  }

  // Go
  if (ext === 'go') {
    return (
      <svg className={`${className} text-cyan-400`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M1.81 10.26c-.06 0-.1-.03-.08-.09l.32-.79c.02-.06.08-.1.14-.1h5.45c.06 0 .09.05.07.11l-.26.75c-.02.06-.08.11-.14.11l-5.5.01zm-1.53 1.61c-.06 0-.1-.03-.08-.09l.32-.79c.02-.06.08-.1.14-.1h6.99c.06 0 .1.05.08.11l-.12.71c-.01.06-.07.11-.13.11l-7.2.05zm2.48 1.61c-.06 0-.09-.05-.07-.11l.21-.74c.02-.06.08-.1.13-.1h3.07c.06 0 .1.05.09.12l-.03.7c-.01.06-.06.11-.12.11l-3.28.02zm13.93-3.38a10.26 10.26 0 00-3.63-.73c-1.26.01-2.2.36-2.84.93-.64.58-.97 1.38-.97 2.4 0 1.07.41 1.93 1.24 2.57.73.57 1.73.86 3.01.86 1.15 0 2.23-.23 3.25-.67.08-.04.1-.08.1-.16v-1.47c0-.11-.05-.17-.16-.17-.68.23-1.3.4-1.86.48-.56.1-1.13.14-1.72.14-.69 0-1.26-.13-1.7-.37-.5-.28-.75-.74-.75-1.38 0-.63.22-1.11.65-1.44.44-.33 1.06-.5 1.86-.5.54 0 1.05.05 1.55.14.5.1 1.02.25 1.57.44.05.02.1.02.13-.01.04-.03.05-.07.05-.13V9.19c0-.08-.01-.13-.04-.16-.03-.03-.07-.05-.14-.07z" />
        <path d="M23.51 14.39c-.86.91-2.1 1.37-3.71 1.37-.62 0-1.19-.06-1.71-.19a5.35 5.35 0 01-1.4-.53c-.06-.03-.09-.08-.09-.16v-1.49c0-.11.07-.15.18-.09a6.54 6.54 0 003.04.75c.57 0 1.02-.1 1.34-.3.32-.2.48-.52.48-.94 0-.31-.11-.57-.32-.78-.21-.21-.62-.43-1.24-.67-.94-.35-1.64-.76-2.1-1.22-.45-.47-.68-1.06-.68-1.77 0-.84.32-1.53.96-2.06.64-.53 1.52-.79 2.63-.79 1.16 0 2.11.2 2.87.6.04.03.07.08.07.15v1.46c0 .1-.06.14-.17.1a5.7 5.7 0 00-2.78-.66c-.5 0-.89.09-1.19.27-.3.18-.44.45-.44.81 0 .3.12.55.35.74.24.19.68.41 1.35.65.71.25 1.28.51 1.7.76.42.26.75.57.98.93.22.36.34.8.34 1.31 0 .78-.27 1.46-.8 2.03z" />
      </svg>
    )
  }

  // Rust
  if (ext === 'rs') {
    return (
      <svg className={`${className} text-orange-400`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M23.69 11.35l-.89-.55a12.4 12.4 0 00-.12-1.33l.78-.68c.16-.14.2-.38.09-.56l-.71-1.18a.43.43 0 00-.54-.17l-.98.37a10.9 10.9 0 00-.9-.9l.37-.98a.43.43 0 00-.17-.54l-1.18-.71a.43.43 0 00-.56.1l-.68.77a12 12 0 00-1.33-.12l-.55-.89a.43.43 0 00-.57-.14l-1.24.62c-.19.1-.29.32-.23.53l.27 1.02c-.47.22-.9.48-1.31.79l-.91-.5a.43.43 0 00-.56.06l-.93.93a.43.43 0 00-.06.56l.5.91a10.9 10.9 0 00-.79 1.31l-1.02-.27a.43.43 0 00-.53.23l-.62 1.24c-.1.19-.05.42.14.57l.89.55c-.05.44-.08.88-.12 1.33l-.78.68a.43.43 0 00-.09.56l.71 1.18c.12.19.35.26.54.17l.98-.37c.27.32.57.62.9.9l-.37.98a.43.43 0 00.17.54l1.18.71c.18.1.42.05.56-.1l.68-.77c.44.05.88.08 1.33.12l.55.89c.1.16.3.24.5.2l1.24-.33c.2-.05.35-.24.36-.45l.06-1.05c.47-.18.92-.4 1.34-.67l.88.59c.17.11.39.08.54-.07l.97-.97a.43.43 0 00.07-.54l-.59-.88c.27-.42.49-.87.67-1.34l1.05-.06c.21-.01.4-.16.45-.36l.33-1.24a.43.43 0 00-.2-.5zM12 15.5a3.5 3.5 0 110-7 3.5 3.5 0 010 7z" />
      </svg>
    )
  }

  // Java
  if (ext === 'java' || ext === 'jar' || ext === 'class') {
    return (
      <svg className={`${className} text-red-500`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M8.85 18.17s-.84.49.6.66c1.74.2 2.63.17 4.55-.19 0 0 .5.32 1.21.6-4.32 1.85-9.78-.11-6.36-1.07zm-.53-2.45s-.94.7.5.85c1.86.19 3.33.21 5.87-.28 0 0 .35.36.9.55-5.22 1.53-11.04.12-7.27-1.12zm7.14 5.91s.62.51-.68.91c-2.47.76-10.29.99-12.46.03-.78-.35.69-.83 1.15-.93.48-.11.76-.09.76-.09-.87-.62-5.64 1.21-2.42 1.74 8.77 1.44 16-.65 13.65-1.66zm-6.1-4.44s-4 .95-1.41 1.3c1.09.15 3.27.11 5.3-.06 1.66-.14 3.33-.44 3.33-.44s-.59.25-1.01.54c-4.09 1.08-11.99.58-9.72-.53 1.92-.93 3.51-.81 3.51-.81zm7.24 4.04c4.16-2.16 2.24-4.24.89-3.96-.33.07-.48.13-.48.13s.12-.19.36-.28c2.68-.94 4.74 2.78-.86 4.25 0 0 .07-.06.09-.14zM12.03 6s2.3 2.3-2.19 5.84c-3.6 2.84-.82 4.46 0 6.31-2.1-1.9-3.65-3.57-2.61-5.12 1.52-2.29 5.75-3.4 4.8-7.03z" />
        <path d="M9.37 22.73c4 .26 10.14-.14 10.29-2.05 0 0-.28.72-3.3 1.29-3.41.65-7.62.57-10.11.16 0 0 .51.42 3.12.6z" />
      </svg>
    )
  }

  // C/C++
  if (ext === 'c' || ext === 'cpp' || ext === 'cc' || ext === 'cxx' || ext === 'h' || ext === 'hpp') {
    const isHeader = ext === 'h' || ext === 'hpp'
    const isCpp = ext !== 'c' && ext !== 'h'
    return (
      <svg className={className} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="10" fill={isCpp ? '#00599C' : '#5C8DBC'} />
        <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">
          {isHeader ? 'H' : isCpp ? 'C++' : 'C'}
        </text>
      </svg>
    )
  }

  // Ruby
  if (ext === 'rb' || ext === 'erb' || ext === 'gemspec' || lowerName === 'gemfile' || lowerName === 'rakefile') {
    return (
      <svg className={`${className} text-red-600`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M5.05 18.96l-.01-.03L3 15l2.18-4.24L9.25 8l5.15-1.94 4.76.2.78.74.78 4L18.5 15l-4.35 3.51-5.22 1.19-3.88-.74zm13.04-.49l1.73-7.43-5.38 6.2 3.65 1.23zm-5.58 1.12l4.9-1.34-3.82-1.18-4.89 1.62 3.81.9zm-4.69-1.05l4.59-1.52-4.24-2.52-3.8 1.73 3.45 2.31zm9.5-2.55l5.35-6.3-3.52-.9-5.43 4.32 3.6 2.88zm-4.58-3.5l5.26-4.12-4.7-.42-4.76 2.1 4.2 2.44zm-4.98-2.03l4.35-1.94-4.4-1.78-3.76 2.13 3.81 1.59zm7.56-3.15l4.3.1-.91-.89-4.08-.15.69.94z" />
      </svg>
    )
  }

  // PHP
  if (ext === 'php') {
    return (
      <svg className={className} viewBox="0 0 24 24">
        <ellipse cx="12" cy="12" rx="11" ry="7" fill="#777bb3" />
        <path d="M7.5 9h1.5l-.5 2h1c1.1 0 1.7.5 1.5 1.5l-.5 2c-.2 1-.9 1.5-2 1.5H6l.5-2h1l.3-1h-1c-.8 0-1.2-.4-1-1.2L7.5 9zm6 0h1.5l-.5 2h1c1.1 0 1.7.5 1.5 1.5l-.5 2c-.2 1-.9 1.5-2 1.5H12l.5-2h1l.3-1h-1c-.8 0-1.2-.4-1-1.2l1.2-2.8z" fill="white" />
      </svg>
    )
  }

  // Shell/Bash
  if (ext === 'sh' || ext === 'bash' || ext === 'zsh' || lowerName === '.bashrc' || lowerName === '.zshrc') {
    return (
      <svg className={`${className} text-green-400`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm3 11l4-4-4-4 1.5-1.5L15 10l-5.5 5.5L8 14zm5 2h4v2h-4v-2z" />
      </svg>
    )
  }

  // YAML/YML
  if (ext === 'yml' || ext === 'yaml') {
    return (
      <svg className={`${className} text-purple-400`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 4h16v16H4V4zm2 2v12h12V6H6zm2 2h2l2 4 2-4h2l-3 5v3h-2v-3L8 8z" />
      </svg>
    )
  }

  // XML/SVG
  if (ext === 'xml' || ext === 'plist' || ext === 'xib' || ext === 'storyboard') {
    return (
      <svg className={`${className} text-orange-400`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L2 7v10l10 5 10-5V7L12 2zm-2 15l-4-2V9l4 2v6zm1-7L7 8l5-2.5L17 8l-4 2h-2zm5 5l-4 2v-6l4-2v6z" />
      </svg>
    )
  }

  // SVG Image
  if (ext === 'svg') {
    return (
      <svg className={`${className} text-yellow-500`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm13 12l-3-4-2 3-3-4-4 5h12zM7.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
      </svg>
    )
  }

  // Images
  if (ext === 'png' || ext === 'jpg' || ext === 'jpeg' || ext === 'gif' || ext === 'webp' || ext === 'ico') {
    return (
      <svg className={`${className} text-purple-400`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2zm13 12l-3-4-2 3-3-4-4 5h12zM7.5 9a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />
      </svg>
    )
  }

  // Git files
  if (lowerName === '.gitignore' || lowerName === '.gitattributes' || lowerName === '.gitmodules') {
    return (
      <svg className={`${className} text-orange-500`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.62 11.11l-8.73-8.73a1.3 1.3 0 00-1.84 0L9.04 4.4l2.33 2.33a1.55 1.55 0 011.96 1.98l2.24 2.24a1.55 1.55 0 11-.93.87l-2.1-2.1v5.5a1.56 1.56 0 11-1.28-.02V9.59a1.55 1.55 0 01-.84-2.04L8.08 5.21l-5.7 5.7a1.3 1.3 0 000 1.84l8.73 8.73c.51.5 1.33.5 1.84 0l8.67-8.67c.51-.5.51-1.33 0-1.84v.14z" />
      </svg>
    )
  }

  // Environment files
  if (lowerName.startsWith('.env') || ext === 'env') {
    return (
      <svg className={`${className} text-yellow-500`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    )
  }

  // Docker
  if (lowerName === 'dockerfile' || lowerName.startsWith('docker-compose') || ext === 'dockerignore') {
    return (
      <svg className={`${className} text-blue-400`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.98 11.08h2.12a.19.19 0 00.19-.19V9.01a.19.19 0 00-.19-.19h-2.12a.19.19 0 00-.19.19v1.88c0 .11.08.19.19.19zm-2.95-5.43h2.12a.19.19 0 00.19-.19V3.58a.19.19 0 00-.19-.19H11.03a.19.19 0 00-.19.19v1.88c0 .11.08.19.19.19zm0 2.71h2.12a.19.19 0 00.19-.19V6.29a.19.19 0 00-.19-.19H11.03a.19.19 0 00-.19.19v1.88c0 .11.08.19.19.19zm-2.93 0h2.12a.19.19 0 00.19-.19V6.29a.19.19 0 00-.19-.19H8.1a.19.19 0 00-.19.19v1.88c0 .11.08.19.19.19zm-2.96 0h2.12a.19.19 0 00.19-.19V6.29a.19.19 0 00-.19-.19H5.14a.19.19 0 00-.19.19v1.88c0 .11.08.19.19.19zm5.89 2.72h2.12a.19.19 0 00.19-.19V9.01a.19.19 0 00-.19-.19H11.03a.19.19 0 00-.19.19v1.88c0 .11.08.19.19.19zm-2.93 0h2.12a.19.19 0 00.19-.19V9.01a.19.19 0 00-.19-.19H8.1a.19.19 0 00-.19.19v1.88c0 .11.08.19.19.19zm-2.96 0h2.12a.19.19 0 00.19-.19V9.01a.19.19 0 00-.19-.19H5.14a.19.19 0 00-.19.19v1.88c0 .11.08.19.19.19zm-2.92 0h2.12a.19.19 0 00.19-.19V9.01a.19.19 0 00-.19-.19H2.22a.19.19 0 00-.19.19v1.88c0 .11.08.19.19.19zm21.54 1.19c-.06-.05-.67-.51-1.95-.51-.34 0-.68.03-1.01.09-.19-1.3-1.15-1.94-1.2-1.97l-.24-.14-.15.23c-.19.29-.33.6-.43.94-.18.55-.22 1.15-.1 1.7-.43.25-1.12.31-1.26.32H2.22a.5.5 0 00-.5.5c-.01.8.07 1.59.24 2.37.2.91.56 1.76 1.15 2.49.67.83 1.58 1.44 2.65 1.76 1.18.36 2.47.52 3.71.46a12.04 12.04 0 002.74-.35 8.56 8.56 0 002.61-1.2c.78-.56 1.47-1.26 2.02-2.08.87-1.29 1.4-2.73 1.62-4.24h.15c.94 0 1.52-.38 1.84-.69.21-.2.38-.44.48-.72l.05-.17-.14-.1z" />
      </svg>
    )
  }

  // Package files
  if (lowerName === 'package.json' || lowerName === 'package-lock.json') {
    return (
      <svg className={`${className} text-green-500`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L3 7l1.63 9L12 22l7.37-6L21 7l-9-5zm0 2.18l6.22 3.45-.16.91-6.06 3.36-6.06-3.36-.16-.91L12 4.18zM5.27 8.68l5.84 3.24v7.63l-4.47-3.58L5.27 8.68zm13.46 0l-1.37 7.29-4.47 3.58v-7.63l5.84-3.24z" />
      </svg>
    )
  }

  // Lock files
  if (ext === 'lock' || lowerName.includes('.lock')) {
    return (
      <svg className={`${className} text-gray-400`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 17a2 2 0 002-2c0-1.11-.89-2-2-2a2 2 0 00-2 2c0 1.11.89 2 2 2zm6-9a2 2 0 012 2v10a2 2 0 01-2 2H6a2 2 0 01-2-2V10c0-1.11.89-2 2-2h1V6a5 5 0 1110 0v2h1zm-6-5a3 3 0 00-3 3v2h6V6a3 3 0 00-3-3z" />
      </svg>
    )
  }

  // Config files
  if (lowerName.endsWith('.config.js') || lowerName.endsWith('.config.ts') || lowerName.startsWith('tsconfig') || lowerName.startsWith('jsconfig') || lowerName === '.eslintrc' || lowerName === '.prettierrc') {
    return (
      <svg className={`${className} text-gray-400`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 15.5A3.5 3.5 0 018.5 12 3.5 3.5 0 0112 8.5a3.5 3.5 0 013.5 3.5 3.5 3.5 0 01-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97 0-.33-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0014 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1 0 .33.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z" />
      </svg>
    )
  }

  // Video files
  if (ext === 'mp4' || ext === 'mov' || ext === 'avi' || ext === 'mkv' || ext === 'webm') {
    return (
      <svg className={`${className} text-pink-400`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4a2 2 0 00-2 2v12a2 2 0 002 2h16a2 2 0 002-2V4h-4z" />
      </svg>
    )
  }

  // Audio files
  if (ext === 'mp3' || ext === 'wav' || ext === 'ogg' || ext === 'flac' || ext === 'm4a') {
    return (
      <svg className={`${className} text-green-400`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
      </svg>
    )
  }

  // Font files
  if (ext === 'ttf' || ext === 'otf' || ext === 'woff' || ext === 'woff2' || ext === 'eot') {
    return (
      <svg className={`${className} text-red-300`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M9.93 13.5h4.14L12 7.98l-2.07 5.52zM20 2H4c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-4.05 16.5l-1.14-3H9.17l-1.12 3H5.96l5.11-13h1.86l5.11 13h-2.09z" />
      </svg>
    )
  }

  // PDF
  if (ext === 'pdf') {
    return (
      <svg className={`${className} text-red-500`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-9.5 8.5c0 .83-.67 1.5-1.5 1.5H7v2H5.5V9H8c.83 0 1.5.67 1.5 1.5v1zm5 2c0 .83-.67 1.5-1.5 1.5h-2.5V9H13c.83 0 1.5.67 1.5 1.5v3zm4-3H17v1h1.5v1.5H17v2h-1.5V9h3v1.5zM7 10.5h1v1H7v-1zm5 0h1v3h-1v-3z" />
      </svg>
    )
  }

  // Xcode project
  if (ext === 'xcodeproj' || ext === 'xcworkspace') {
    return (
      <svg className={`${className} text-blue-500`} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
      </svg>
    )
  }

  // Default file icon
  return (
    <svg className={`${className} text-gray-400`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
    </svg>
  )
}
