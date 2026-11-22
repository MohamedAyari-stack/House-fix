<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AdminExport;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * GET /admin/export?type=…&format=csv|xlsx&du=YYYY-MM-DD&au=YYYY-MM-DD
 * Downloads a dataset (or every dataset as one Excel workbook) in the request language.
 */
class AdminExportController extends Controller
{
    public function __invoke(Request $request): StreamedResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::in([...AdminExport::DATASETS, AdminExport::ALL])],
            'format' => ['required', Rule::in(['csv', 'xlsx'])],
            'du' => ['nullable', 'date_format:Y-m-d'],
            'au' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:du'],
        ]);

        // A CSV file holds a single table: the statistics have 3 (indicators, statuses, months).
        if ($data['format'] === 'csv' && $data['type'] === AdminExport::ALL) {
            throw ValidationException::withMessages(['format' => [__('export.csv_tout')]]);
        }

        $export = new AdminExport(
            isset($data['du']) ? Carbon::parse($data['du']) : null,
            isset($data['au']) ? Carbon::parse($data['au']) : null,
        );
        $sheets = $export->sheets($data['type']);
        $filename = 'housefix-'.str_replace('_', '-', $data['type']).'-'.now()->format('Y-m-d').'.'.$data['format'];

        if ($data['format'] === 'xlsx') {
            return response()->streamDownload(fn () => $export->writeXlsx($sheets), $filename, [
                'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ]);
        }

        // CSV of the statistics: the indicators table (the other two are in the Excel workbook).
        return response()->streamDownload(fn () => $export->writeCsv($sheets[0]), $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
