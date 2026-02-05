// File icons using Seti UI (https://github.com/jesseweed/seti-ui)

interface FileIconProps {
  name: string
  isDirectory?: boolean
  className?: string
}

// Seti UI color palette
const colors = {
  blue: '#519aba',
  grey: '#4d5a5e',
  'grey-light': '#6d8086',
  green: '#8dc149',
  orange: '#e37933',
  pink: '#f55385',
  purple: '#a074c4',
  red: '#cc3e44',
  white: '#d4d7d6',
  yellow: '#cbcb41',
  ignore: '#41535b',
}

type ColorName = keyof typeof colors

// Map file extensions to [icon name, color]
const extensionMap: Record<string, [string, ColorName]> = {
  // TypeScript
  ts: ['typescript', 'blue'],
  tsx: ['react', 'blue'],
  // JavaScript
  js: ['javascript', 'yellow'],
  jsx: ['react', 'blue'],
  mjs: ['javascript', 'yellow'],
  cjs: ['javascript', 'yellow'],
  // Web
  html: ['html', 'orange'],
  htm: ['html', 'orange'],
  css: ['css', 'blue'],
  scss: ['sass', 'pink'],
  sass: ['sass', 'pink'],
  less: ['less', 'blue'],
  // Data
  json: ['json', 'yellow'],
  yaml: ['yml', 'purple'],
  yml: ['yml', 'purple'],
  xml: ['xml', 'orange'],
  csv: ['csv', 'green'],
  // Markdown
  md: ['markdown', 'blue'],
  mdx: ['markdown', 'blue'],
  // Languages
  py: ['python', 'blue'],
  rb: ['ruby', 'red'],
  go: ['go', 'blue'],
  rs: ['rust', 'grey-light'],
  java: ['java', 'red'],
  kt: ['kotlin', 'orange'],
  kts: ['kotlin', 'orange'],
  swift: ['swift', 'orange'],
  c: ['c', 'blue'],
  h: ['c', 'purple'],
  cpp: ['cpp', 'blue'],
  hpp: ['cpp', 'purple'],
  cc: ['cpp', 'blue'],
  cxx: ['cpp', 'blue'],
  cs: ['c-sharp', 'blue'],
  php: ['php', 'purple'],
  r: ['R', 'blue'],
  scala: ['scala', 'red'],
  dart: ['dart', 'blue'],
  lua: ['lua', 'blue'],
  pl: ['perl', 'blue'],
  ex: ['elixir', 'purple'],
  exs: ['elixir_script', 'purple'],
  erl: ['erlang', 'red'],
  hs: ['haskell', 'purple'],
  clj: ['clojure', 'green'],
  elm: ['elm', 'blue'],
  nim: ['nim', 'yellow'],
  zig: ['zig', 'orange'],
  jl: ['julia', 'purple'],
  // Shell
  sh: ['shell', 'green'],
  bash: ['shell', 'green'],
  zsh: ['shell', 'green'],
  fish: ['shell', 'green'],
  ps1: ['powershell', 'blue'],
  // Config
  toml: ['config', 'grey-light'],
  ini: ['config', 'grey-light'],
  conf: ['config', 'grey-light'],
  cfg: ['config', 'grey-light'],
  // Build tools
  gradle: ['gradle', 'blue'],
  // Images
  svg: ['svg', 'purple'],
  png: ['image', 'purple'],
  jpg: ['image', 'purple'],
  jpeg: ['image', 'purple'],
  gif: ['image', 'purple'],
  webp: ['image', 'purple'],
  ico: ['favicon', 'yellow'],
  // Documents
  pdf: ['pdf', 'red'],
  doc: ['word', 'blue'],
  docx: ['word', 'blue'],
  xls: ['xls', 'green'],
  xlsx: ['xls', 'green'],
  // Media
  mp3: ['audio', 'purple'],
  wav: ['audio', 'purple'],
  ogg: ['audio', 'purple'],
  flac: ['audio', 'purple'],
  mp4: ['video', 'pink'],
  mov: ['video', 'pink'],
  webm: ['video', 'pink'],
  avi: ['video', 'pink'],
  // Font
  ttf: ['font', 'red'],
  otf: ['font', 'red'],
  woff: ['font', 'red'],
  woff2: ['font', 'red'],
  eot: ['font', 'red'],
  // Archive
  zip: ['zip', 'grey-light'],
  tar: ['zip', 'grey-light'],
  gz: ['zip', 'grey-light'],
  jar: ['zip', 'red'],
  // Templates
  pug: ['pug', 'red'],
  jade: ['jade', 'red'],
  ejs: ['ejs', 'yellow'],
  hbs: ['mustache', 'orange'],
  twig: ['twig', 'green'],
  vue: ['vue', 'green'],
  svelte: ['svelte', 'red'],
  // Other
  graphql: ['graphql', 'pink'],
  gql: ['graphql', 'pink'],
  sql: ['db', 'pink'],
  db: ['db', 'pink'],
  wasm: ['wasm', 'purple'],
  tex: ['tex', 'blue'],
  sol: ['ethereum', 'blue'],
  lock: ['lock', 'green'],
  log: ['config', 'grey-light'],
  txt: ['default', 'white'],
  prisma: ['prisma', 'blue'],
}

// Map specific filenames to [icon name, color]
const filenameMap: Record<string, [string, ColorName]> = {
  // Git
  '.gitignore': ['git', 'ignore'],
  '.gitattributes': ['git', 'ignore'],
  '.gitmodules': ['git', 'ignore'],
  '.gitconfig': ['git', 'ignore'],
  // Package managers
  'package.json': ['npm', 'red'],
  'package-lock.json': ['lock', 'green'],
  'yarn.lock': ['yarn', 'blue'],
  // TypeScript config
  'tsconfig.json': ['tsconfig', 'blue'],
  'tsconfig.node.json': ['tsconfig', 'blue'],
  'tsconfig.node.tsbuildinfo': ['tsconfig', 'blue'],
  // ESLint
  '.eslintrc': ['eslint', 'purple'],
  '.eslintrc.js': ['eslint', 'purple'],
  '.eslintrc.cjs': ['eslint', 'purple'],
  '.eslintrc.json': ['eslint', 'purple'],
  '.eslintignore': ['eslint', 'grey'],
  'eslint.config.js': ['eslint', 'purple'],
  // Prettier
  '.prettierrc': ['config', 'grey-light'],
  '.prettierrc.json': ['config', 'grey-light'],
  // Babel
  '.babelrc': ['babel', 'yellow'],
  'babel.config.js': ['babel', 'yellow'],
  'babel.config.json': ['babel', 'yellow'],
  // Webpack
  'webpack.config.js': ['webpack', 'blue'],
  'webpack.config.ts': ['webpack', 'blue'],
  // Rollup
  'rollup.config.js': ['rollup', 'red'],
  'rollup.config.ts': ['rollup', 'red'],
  // Vite
  'vite.config.ts': ['vite', 'yellow'],
  'vite.config.js': ['vite', 'yellow'],
  'vite.config.mjs': ['vite', 'yellow'],
  // Tailwind
  'tailwind.config.js': ['config', 'grey-light'],
  'tailwind.config.cjs': ['config', 'grey-light'],
  'tailwind.config.ts': ['config', 'grey-light'],
  // PostCSS
  'postcss.config.js': ['config', 'grey-light'],
  'postcss.config.cjs': ['config', 'grey-light'],
  // Docker
  'Dockerfile': ['docker', 'blue'],
  'dockerfile': ['docker', 'blue'],
  'docker-compose.yml': ['docker', 'blue'],
  'docker-compose.yaml': ['docker', 'blue'],
  '.dockerignore': ['docker', 'grey'],
  // Build
  'Makefile': ['config', 'orange'],
  'makefile': ['config', 'orange'],
  'Gulpfile.js': ['gulp', 'red'],
  'Gruntfile.js': ['grunt', 'orange'],
  // Jenkins
  'Jenkinsfile': ['jenkins', 'red'],
  // Special
  'LICENSE': ['license', 'yellow'],
  'LICENSE.md': ['license', 'yellow'],
  'LICENSE.txt': ['license', 'yellow'],
  'README.md': ['info', 'blue'],
  'README': ['info', 'blue'],
  'CLAUDE.md': ['info', 'blue'],
  'CHANGELOG.md': ['clock', 'blue'],
  '.env': ['config', 'grey-light'],
  '.editorconfig': ['editorconfig', 'grey-light'],
  // Firebase
  'firebase.json': ['firebase', 'orange'],
  '.firebaserc': ['firebase', 'orange'],
  // Ionic
  'ionic.config.json': ['ionic', 'blue'],
  // Karma
  'karma.conf.js': ['karma', 'green'],
}

export default function FileIcon({ name, className = 'w-4 h-4' }: FileIconProps) {
  const lowerName = name.toLowerCase()
  const ext = name.split('.').pop()?.toLowerCase() || ''

  let iconName = 'default'
  let color = colors.white

  // Check filename first (case-sensitive, then case-insensitive)
  const filenameMatch = filenameMap[name] || filenameMap[lowerName]
  if (filenameMatch) {
    iconName = filenameMatch[0]
    color = colors[filenameMatch[1]]
  } else if (lowerName.startsWith('.env')) {
    // Check for env files
    iconName = 'config'
    color = colors['grey-light']
  } else if (lowerName.startsWith('tsconfig') && lowerName.endsWith('.json')) {
    // Check for tsconfig variants
    iconName = 'tsconfig'
    color = colors.blue
  } else if (extensionMap[ext]) {
    // Check extension
    iconName = extensionMap[ext][0]
    color = colors[extensionMap[ext][1]]
  }

  // Use CSS mask to allow coloring the SVG
  return (
    <span
      className={className}
      style={{
        display: 'inline-block',
        backgroundColor: color,
        WebkitMaskImage: `url(./seti-icons/${iconName}.svg)`,
        WebkitMaskSize: 'contain',
        WebkitMaskRepeat: 'no-repeat',
        WebkitMaskPosition: 'center',
        maskImage: `url(./seti-icons/${iconName}.svg)`,
        maskSize: 'contain',
        maskRepeat: 'no-repeat',
        maskPosition: 'center',
      }}
      aria-hidden="true"
    />
  )
}
