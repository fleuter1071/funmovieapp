const REQUIRED_COLUMNS = ["Const", "Your Rating", "Title", "Title Type"];

function parseCsvRows(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;

    const normalizedText = String(text || "").replace(/^\uFEFF/, "");

    for (let index = 0; index < normalizedText.length; index += 1) {
        const char = normalizedText[index];
        const next = normalizedText[index + 1];

        if (char === '"') {
            if (inQuotes && next === '"') {
                field += '"';
                index += 1;
            } else {
                inQuotes = !inQuotes;
            }
            continue;
        }

        if (char === "," && !inQuotes) {
            row.push(field);
            field = "";
            continue;
        }

        if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && next === "\n") {
                index += 1;
            }
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
            continue;
        }

        field += char;
    }

    if (field.length || row.length) {
        row.push(field);
        rows.push(row);
    }

    return rows
        .map((cells) => cells.map((cell) => String(cell || "").trim()))
        .filter((cells) => cells.some((cell) => cell.length));
}

function normalizeHeaderKey(value) {
    return String(value || "").trim();
}

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toYear(value) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 1800 ? parsed : null;
}

function buildRecord(rawRow, rowIndex) {
    const imdbId = String(rawRow.Const || "").trim();
    const title = String(rawRow.Title || "").trim();
    const titleType = String(rawRow["Title Type"] || "").trim();
    const imdbUserRating = toNumber(rawRow["Your Rating"]);
    const genres = String(rawRow.Genres || "")
        .split(",")
        .map((genre) => genre.trim())
        .filter(Boolean);

    return {
        id: imdbId || `row_${rowIndex}`,
        rowIndex,
        imdbId,
        title,
        originalTitle: String(rawRow["Original Title"] || "").trim(),
        titleType,
        imdbUserRating,
        dateRated: String(rawRow["Date Rated"] || "").trim(),
        imdbRating: String(rawRow["IMDb Rating"] || "").trim(),
        runtimeMins: toNumber(rawRow["Runtime (mins)"]),
        year: toYear(rawRow.Year),
        genres,
        numVotes: toNumber(rawRow["Num Votes"]),
        releaseDate: String(rawRow["Release Date"] || "").trim(),
        directors: String(rawRow.Directors || "").trim()
    };
}

export function parseImdbRatingsCsv(text, options = {}) {
    const sourceName = String(options.sourceName || "IMDb ratings file").trim();
    const rows = parseCsvRows(text);

    if (!rows.length) {
        throw new Error("This IMDb export file is empty.");
    }

    const [headerRow, ...bodyRows] = rows;
    const headers = headerRow.map(normalizeHeaderKey);
    const missingColumns = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));

    if (missingColumns.length) {
        throw new Error(`This file is missing required IMDb columns: ${missingColumns.join(", ")}`);
    }

    const validRows = [];
    const skipped = {
        nonMovie: [],
        missingId: [],
        invalid: []
    };

    bodyRows.forEach((cells, rowOffset) => {
        const rowIndex = rowOffset + 2;
        const rawRow = {};
        headers.forEach((header, index) => {
            rawRow[header] = index < cells.length ? cells[index] : "";
        });

        const record = buildRecord(rawRow, rowIndex);

        if (!record.title || !record.titleType) {
            skipped.invalid.push({
                rowIndex,
                title: record.title || "Untitled row",
                reason: "Missing title or title type"
            });
            return;
        }

        if (record.titleType !== "Movie") {
            skipped.nonMovie.push({
                rowIndex,
                imdbId: record.imdbId,
                title: record.title,
                titleType: record.titleType
            });
            return;
        }

        if (!record.imdbId) {
            skipped.missingId.push({
                rowIndex,
                title: record.title,
                reason: "Missing IMDb title ID"
            });
            return;
        }

        validRows.push(record);
    });

    if (!validRows.length) {
        throw new Error("No importable movie rows were found in this IMDb file.");
    }

    return {
        sourceName,
        importedAt: new Date().toISOString(),
        headers,
        records: validRows,
        summary: {
            totalRows: bodyRows.length,
            importableMovies: validRows.length,
            skippedNonMovie: skipped.nonMovie.length,
            skippedMissingId: skipped.missingId.length,
            skippedInvalid: skipped.invalid.length
        },
        skipped
    };
}
