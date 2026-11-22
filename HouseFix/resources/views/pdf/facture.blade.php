@php
    $rdv = $facture->rendezVous;
    $statutLabels = ['payee' => 'Payée', 'en_attente' => 'En attente de confirmation', 'non_payee' => 'Non payée'];
    $modeLabels = ['en_ligne' => 'Paiement en ligne (carte)', 'especes' => 'Espèces'];
    $fmt = fn ($n) => number_format((float) $n, 2, ',', ' ').' DT';
    $profile = $facture->prestataire?->prestataireProfile;
@endphp
<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <title>Facture {{ $facture->numero }}</title>
    <style>
        @page { margin: 32px 40px; }
        body { font-family: DejaVu Sans, sans-serif; font-size: 11px; color: #1f2937; }
        .header { border-bottom: 3px solid #2563eb; padding-bottom: 12px; margin-bottom: 20px; }
        .brand { font-size: 26px; font-weight: bold; color: #2563eb; }
        .brand span { color: #f59e0b; }
        .tagline { color: #6b7280; font-size: 10px; }
        .doc-title { text-align: right; }
        .doc-title h1 { margin: 0; font-size: 20px; letter-spacing: 2px; color: #111827; }
        .muted { color: #6b7280; }
        table { width: 100%; border-collapse: collapse; }
        .parties td { width: 50%; vertical-align: top; padding: 10px 12px; background: #f3f4f6; }
        .parties td + td { border-left: 8px solid #fff; }
        .label { font-size: 9px; text-transform: uppercase; letter-spacing: 1px; color: #6b7280; margin-bottom: 4px; }
        .name { font-size: 13px; font-weight: bold; }
        .lines { margin-top: 22px; }
        .lines th { background: #2563eb; color: #fff; text-align: left; padding: 8px; font-size: 10px; }
        .lines td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
        .right { text-align: right; }
        .total td { font-size: 14px; font-weight: bold; border-bottom: none; padding-top: 14px; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 10px; font-weight: bold; font-size: 11px; }
        .badge-payee { background: #dcfce7; color: #166534; }
        .badge-en_attente { background: #fef3c7; color: #92400e; }
        .badge-non_payee { background: #fee2e2; color: #991b1b; }
        .payment { margin-top: 24px; padding: 12px; border: 1px solid #e5e7eb; }
        .footer { position: fixed; bottom: 0; left: 0; right: 0; text-align: center; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 6px; }
    </style>
</head>
<body>
    <table class="header">
        <tr>
            <td>
                <div class="brand">House<span>Fix</span></div>
                <div class="tagline">Plateforme de services à domicile — Tunisie</div>
                <div class="tagline">contact@housefix.tn</div>
            </td>
            <td class="doc-title">
                <h1>FACTURE</h1>
                <div><strong>N° {{ $facture->numero }}</strong></div>
                <div class="muted">Date : {{ \Illuminate\Support\Carbon::parse($facture->date)->format('d/m/Y') }}</div>
            </td>
        </tr>
    </table>

    <table class="parties">
        <tr>
            <td>
                <div class="label">Client</div>
                <div class="name">{{ $facture->client?->nom }}</div>
                <div>{{ $facture->client?->email }}</div>
                <div>{{ $facture->client?->telephone }}</div>
                <div>{{ $rdv?->address ?? $facture->client?->address }}</div>
            </td>
            <td>
                <div class="label">Prestataire</div>
                <div class="name">{{ $facture->prestataire?->nom }}</div>
                @if ($profile?->specialite)<div>{{ $profile->specialite }}</div>@endif
                <div>{{ $facture->prestataire?->email }}</div>
                <div>{{ $facture->prestataire?->telephone }}</div>
                <div>{{ $facture->prestataire?->gouvernorat }}</div>
            </td>
        </tr>
    </table>

    <table class="lines">
        <thead>
            <tr>
                <th style="width: 22%">Service</th>
                <th>Description</th>
                <th style="width: 18%">Date d'intervention</th>
                <th class="right" style="width: 16%">Montant HT</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>{{ $rdv?->categorie?->nom ?? 'Service' }}</td>
                <td>
                    {{ $facture->details ?: $rdv?->description }}
                    @if ($facture->details && $rdv?->description)
                        <div class="muted">Demande : {{ $rdv->description }}</div>
                    @endif
                </td>
                <td>
                    {{ $rdv ? \Illuminate\Support\Carbon::parse($rdv->date)->format('d/m/Y') : '' }}
                    @if ($rdv?->heure) à {{ substr($rdv->heure, 0, 5) }} @endif
                </td>
                <td class="right">{{ $fmt($facture->montant_ht ?? $facture->montant) }}</td>
            </tr>
            <tr>
                <td colspan="3" class="right">Total HT</td>
                <td class="right">{{ $fmt($facture->montant_ht ?? $facture->montant) }}</td>
            </tr>
            <tr>
                <td colspan="3" class="right">TVA ({{ rtrim(rtrim(number_format($facture->taux_tva, 2, ',', ''), '0'), ',') }} %)</td>
                <td class="right">{{ $fmt($facture->montant_tva) }}</td>
            </tr>
            <tr class="total">
                <td colspan="3" class="right">Total TTC à payer</td>
                <td class="right">{{ $fmt($facture->montant) }}</td>
            </tr>
        </tbody>
    </table>

    <div class="payment">
        <div class="label">Statut du paiement</div>
        <span class="badge badge-{{ $facture->statut_paiement }}">{{ $statutLabels[$facture->statut_paiement] ?? $facture->statut_paiement }}</span>
        @if ($facture->mode_paiement)
            &nbsp; Mode : {{ $modeLabels[$facture->mode_paiement] ?? $facture->mode_paiement }}
        @endif
        @if ($facture->paid_at)
            &nbsp; — Payée le {{ $facture->paid_at->format('d/m/Y à H:i') }}
        @endif
        @php $paiement = $facture->paiements->firstWhere('statut', 'valide'); @endphp
        @if ($paiement)
            <div class="muted" style="margin-top: 6px">Référence de paiement : {{ $paiement->reference }}</div>
        @endif
    </div>

    <div class="footer">
        DarFix — Merci pour votre confiance. Facture générée le {{ now()->format('d/m/Y à H:i') }}.
    </div>
</body>
</html>
