// Save a file the page created (PDF, SVG, PNG) through the browser's normal download, without a server round trip.
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  // Give the browser a moment to start the download before releasing the data.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// A tile number or title as part of a file name: "Billings-b" stays, "18 Los Angeles" -> "18-Los-Angeles".
export const fileSafe = (text: string) => text.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'tile'
