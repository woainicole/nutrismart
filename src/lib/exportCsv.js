// Ekspor data ke file CSV dan trigger download

export function exportCsv(filename, headers, rows) {
  const bom = '\uFEFF' // supaya Excel baca UTF-8
  const headerLine = headers.join(',')
  const dataLines = rows.map(row =>
    row.map(cell => {
      const str = String(cell ?? '')
      // Escape kalau ada koma, newline, atau kutip
      return str.includes(',') || str.includes('\n') || str.includes('"')
        ? `"${str.replace(/"/g, '""')}"`
        : str
    }).join(',')
  )
  const csv = bom + [headerLine, ...dataLines].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

