#!/bin/bash

# === Konfigurierbare Ausschlussliste (durch | getrennt) ===
EXCLUDE_DIRS="node_modules|lib|dist|.git|zoompinch|tests|sandbox|elements"

# === Welche Dateitypen sollen einbezogen werden ===
INCLUDE_EXTENSIONS="ts|html|css|js|vue"


OUTPUT_FILE="code_dump.md"

# Alte Datei ggf. löschen
rm -f "$OUTPUT_FILE"

echo "===== FILE DUMP START =====" >> "$OUTPUT_FILE"

# Finde passende Dateien, schließe bestimmte Ordner aus
find . -type f \( -iname "*.ts" -o -iname "*.html" -o -iname "*.css" -o -iname "*.vue" \) | \
  grep -Ev "/($EXCLUDE_DIRS)/" | while read file; do
    echo "" >> "$OUTPUT_FILE"
    echo "### FILE: $file ###" >> "$OUTPUT_FILE"
    
    # Passende Codeblock-Syntax
    ext="${file##*.}"
    echo "\`\`\`$ext" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    echo "\`\`\`" >> "$OUTPUT_FILE"
done

echo "" >> "$OUTPUT_FILE"
echo "===== FILE DUMP END =====" >> "$OUTPUT_FILE"

echo "✅ Dump erfolgreich erstellt in: $OUTPUT_FILE"