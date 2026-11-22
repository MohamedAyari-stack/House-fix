<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\NotificationResource;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = $request->user()->appNotifications();

        return response()->json([
            'items' => NotificationResource::collection(
                (clone $notifications)->latest()->orderByDesc('id')->limit(50)->get()
            ),
            'non_lues' => (clone $notifications)->where('lu', false)->count(),
        ]);
    }

    public function markRead(Request $request, int $id): JsonResponse
    {
        $request->user()->appNotifications()->findOrFail($id)->update(['lu' => true]);

        return response()->json(['message' => __('Notification marquée comme lue.')]);
    }

    public function markAllRead(Request $request): JsonResponse
    {
        $request->user()->appNotifications()->where('lu', false)->update(['lu' => true]);

        return response()->json(['message' => __('Toutes les notifications ont été marquées comme lues.')]);
    }
}
