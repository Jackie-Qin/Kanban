import { exec } from 'child_process'

export function openInITerm(projectPath: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const escapedPath = projectPath.replace(/"/g, '\\"')

    const script = `
      tell application "iTerm2"
        activate
        create window with default profile
        tell current session of current window
          write text "cd \\"${escapedPath}\\""
        end tell
      end tell
    `

    exec(`osascript -e '${script}'`, (error) => {
      if (error) {
        // Fallback to Terminal if iTerm2 is not installed
        const terminalScript = `
          tell application "Terminal"
            activate
            do script "cd \\"${escapedPath}\\""
          end tell
        `
        exec(`osascript -e '${terminalScript}'`, (termError) => {
          if (termError) {
            reject(termError)
          } else {
            resolve(true)
          }
        })
      } else {
        resolve(true)
      }
    })
  })
}
