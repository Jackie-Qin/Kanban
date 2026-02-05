import type { ITheme } from '@xterm/xterm'

export const DEFAULT_FONT_SIZE = 13
export const MIN_FONT_SIZE = 8
export const MAX_FONT_SIZE = 24
export const DEFAULT_FONT_FAMILY = 'Monaco'

export const FONT_FAMILIES = [
  { label: 'Monaco', value: 'Monaco' },
  { label: 'Menlo', value: 'Menlo' },
  { label: 'SF Mono', value: 'SF Mono' },
  { label: 'Fira Code', value: 'Fira Code' },
  { label: 'JetBrains Mono', value: 'JetBrains Mono' },
  { label: 'Consolas', value: 'Consolas' },
] as const

export interface TerminalTheme {
  name: string
  theme: ITheme
}

const dark: TerminalTheme = {
  name: 'Dark',
  theme: {
    background: '#14191e',
    foreground: '#dbdbdb',
    cursor: '#fefffe',
    cursorAccent: '#000000',
    selectionBackground: '#b3d7ff',
    selectionForeground: '#000000',
    black: '#14191e',
    red: '#b43c29',
    green: '#00c200',
    yellow: '#c7c400',
    blue: '#2743c7',
    magenta: '#bf3fbd',
    cyan: '#00c5c7',
    white: '#c7c7c7',
    brightBlack: '#676767',
    brightRed: '#dc7974',
    brightGreen: '#57e690',
    brightYellow: '#ece100',
    brightBlue: '#a6aaf1',
    brightMagenta: '#e07de0',
    brightCyan: '#5ffdff',
    brightWhite: '#feffff',
  },
}

const dracula: TerminalTheme = {
  name: 'Dracula',
  theme: {
    background: '#282a36',
    foreground: '#f8f8f2',
    cursor: '#f8f8f2',
    cursorAccent: '#282a36',
    selectionBackground: '#44475a',
    selectionForeground: '#f8f8f2',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  },
}

const solarizedDark: TerminalTheme = {
  name: 'Solarized Dark',
  theme: {
    background: '#002b36',
    foreground: '#839496',
    cursor: '#839496',
    cursorAccent: '#002b36',
    selectionBackground: '#073642',
    selectionForeground: '#93a1a1',
    black: '#073642',
    red: '#dc322f',
    green: '#859900',
    yellow: '#b58900',
    blue: '#268bd2',
    magenta: '#d33682',
    cyan: '#2aa198',
    white: '#eee8d5',
    brightBlack: '#586e75',
    brightRed: '#cb4b16',
    brightGreen: '#586e75',
    brightYellow: '#657b83',
    brightBlue: '#839496',
    brightMagenta: '#6c71c4',
    brightCyan: '#93a1a1',
    brightWhite: '#fdf6e3',
  },
}

const oneDark: TerminalTheme = {
  name: 'One Dark',
  theme: {
    background: '#282c34',
    foreground: '#abb2bf',
    cursor: '#528bff',
    cursorAccent: '#282c34',
    selectionBackground: '#3e4451',
    selectionForeground: '#abb2bf',
    black: '#282c34',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#e5c07b',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#abb2bf',
    brightBlack: '#5c6370',
    brightRed: '#e06c75',
    brightGreen: '#98c379',
    brightYellow: '#e5c07b',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff',
  },
}

const monokai: TerminalTheme = {
  name: 'Monokai',
  theme: {
    background: '#272822',
    foreground: '#f8f8f2',
    cursor: '#f8f8f0',
    cursorAccent: '#272822',
    selectionBackground: '#49483e',
    selectionForeground: '#f8f8f2',
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2',
    brightBlack: '#75715e',
    brightRed: '#f92672',
    brightGreen: '#a6e22e',
    brightYellow: '#f4bf75',
    brightBlue: '#66d9ef',
    brightMagenta: '#ae81ff',
    brightCyan: '#a1efe4',
    brightWhite: '#f9f8f5',
  },
}

export const terminalThemes: TerminalTheme[] = [dark, dracula, solarizedDark, oneDark, monokai]

export function getThemeByName(name: string): TerminalTheme {
  return terminalThemes.find((t) => t.name === name) || dark
}
