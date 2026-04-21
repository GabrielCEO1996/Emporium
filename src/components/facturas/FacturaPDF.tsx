'use client'

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Svg,
  Rect,
  Circle,
  Path,
} from '@react-pdf/renderer'
import { Factura } from '@/lib/types'

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtCurrency(amount: number): string {
  return new Intl.NumberFormat('es-VE', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount ?? 0)
}

function fmtDate(dateString?: string | null): string {
  if (!dateString) return '—'
  return new Intl.DateTimeFormat('es-VE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(dateString))
}

// ─── Color palette (Navy blue theme) ─────────────────────────────────────────

const C = {
  navy:       '#0f2044',   // cabecera principal
  navyMid:    '#1a3560',   // gradiente / fila alternada encabezado
  blue:       '#1e4db7',   // acentos
  blueLight:  '#dbeafe',   // fondos suaves
  blueUltra:  '#eff6ff',   // fondos ultra suaves
  white:      '#ffffff',
  text:       '#1e293b',
  textMid:    '#475569',
  textMuted:  '#94a3b8',
  border:     '#e2e8f0',
  green:      '#16a34a',
  greenLight: '#dcfce7',
  red:        '#dc2626',
  amber:      '#d97706',
  amberLight: '#fef3c7',
  bgPage:     '#f8fafc',
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: C.text,
    backgroundColor: C.bgPage,
    paddingBottom: 48,
  },

  // ── Navy header band ──
  headerBand: {
    backgroundColor: C.navy,
    paddingHorizontal: 40,
    paddingTop: 28,
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },

  // Logo block
  logoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  logoIcon: {
    width: 38,
    height: 38,
    backgroundColor: C.blue,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoIconText: {
    fontSize: 18,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
  },
  companyName: {
    fontSize: 20,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    letterSpacing: 1,
  },
  companyTagline: {
    fontSize: 8,
    color: '#93c5fd',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  companyContact: {
    fontSize: 7.5,
    color: '#bfdbfe',
    marginTop: 6,
    lineHeight: 1.6,
  },

  // Invoice title block (right side of header)
  invoiceTitleBlock: {
    alignItems: 'flex-end',
  },
  invoiceWordLabel: {
    fontSize: 26,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    letterSpacing: 2,
    opacity: 0.9,
  },
  invoiceNumberBig: {
    fontSize: 13,
    fontFamily: 'Helvetica-Bold',
    color: '#93c5fd',
    marginTop: 2,
    letterSpacing: 0.5,
  },

  // Estado badge
  estadoBadge: {
    marginTop: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    alignSelf: 'flex-end',
  },
  estadoBadgeText: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
  },

  // ── Accent stripe under header ──
  accentStripe: {
    height: 4,
    backgroundColor: C.blue,
  },

  // ── Body content ──
  body: {
    paddingHorizontal: 40,
    paddingTop: 20,
  },

  // ── Meta row: dates + client ──
  metaRow: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 20,
  },
  metaCard: {
    flex: 1,
    backgroundColor: C.white,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  metaCardTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.blue,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: C.blueLight,
    paddingBottom: 4,
  },
  metaItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metaLabel: { fontSize: 8, color: C.textMuted },
  metaValue: { fontSize: 8, fontFamily: 'Helvetica-Bold', color: C.text },
  metaValueAccent: { fontSize: 9, fontFamily: 'Helvetica-Bold', color: C.navy },

  // ── Items table ──
  tableSectionTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: C.navy,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  tableWrapper: {
    marginBottom: 20,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: C.navy,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  thCell: {
    fontSize: 7.5,
    fontFamily: 'Helvetica-Bold',
    color: C.white,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: C.white,
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  tableRowAlt: {
    backgroundColor: C.blueUltra,
  },
  tdCell: {
    fontSize: 8.5,
    color: C.text,
  },
  tdCellMuted: {
    fontSize: 8.5,
    color: C.textMuted,
  },

  // Column sizes
  cDesc:  { flex: 5 },
  cQty:   { flex: 1, textAlign: 'right' as const },
  cPrice: { flex: 2, textAlign: 'right' as const },
  cDisc:  { flex: 1.5, textAlign: 'right' as const },
  cSub:   { flex: 2, textAlign: 'right' as const },

  // ── Totals ──
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 20,
  },
  totalsBox: {
    width: 230,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  tRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 14,
    backgroundColor: C.white,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tLabel: { fontSize: 8.5, color: C.textMid },
  tValue: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.text },
  tRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: C.navy,
  },
  tLabelTotal: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: C.white },
  tValueTotal: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#93c5fd' },
  tRowSaldo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 7,
    paddingHorizontal: 14,
    backgroundColor: C.blueLight,
  },
  tLabelSaldo: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.navy },
  tValueSaldo: { fontSize: 8.5, fontFamily: 'Helvetica-Bold', color: C.navy },

  // ── Notes ──
  notesBox: {
    backgroundColor: C.white,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 16,
  },
  notesTitle: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: C.blue,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  notesText: { fontSize: 8.5, color: C.textMid, lineHeight: 1.5 },

  // ── Footer ──
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: C.navy,
    paddingHorizontal: 40,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: { fontSize: 7.5, color: '#93c5fd' },
  footerMid: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', color: C.white },
})

// ─── Estado config ────────────────────────────────────────────────────────────

const ESTADO_CFG: Record<string, { label: string; bg: string; color: string }> = {
  emitida:         { label: 'EMITIDA',          bg: C.blueLight,   color: C.blue },
  pagada:          { label: 'PAGADA',            bg: C.greenLight,  color: C.green },
  anulada:         { label: 'ANULADA',           bg: '#fee2e2',     color: C.red },
  con_nota_credito:{ label: 'CON NOTA CRÉDITO',  bg: C.amberLight,  color: C.amber },
}

// ─── Component ───────────────────────────────────────────────────────────────

interface FacturaPDFProps {
  factura: Factura
}

export default function FacturaPDF({ factura }: FacturaPDFProps) {
  const f = factura
  const tasaImpuesto = f.tasa_impuesto ?? 16
  const saldo = (f.total ?? 0) - (f.monto_pagado ?? 0)
  const estadoCfg = ESTADO_CFG[f.estado] ?? { label: f.estado.toUpperCase(), bg: C.blueLight, color: C.blue }

  return (
    <Document
      title={`Factura ${f.numero}`}
      author="EMPORIUM Distribución"
      subject={`Factura ${f.numero} — ${f.cliente?.nombre ?? ''}`}
    >
      <Page size="A4" style={S.page}>

        {/* ══ NAVY HEADER BAND ══ */}
        <View style={S.headerBand}>
          <View style={S.headerRow}>

            {/* Left: Logo + company info */}
            <View>
              <View style={S.logoBox}>
                <View style={S.logoIcon}>
                  <Text style={S.logoIconText}>E</Text>
                </View>
                <View>
                  <Text style={S.companyName}>EMPORIUM</Text>
                  <Text style={S.companyTagline}>DISTRIBUCIÓN COMERCIAL</Text>
                </View>
              </View>
              <Text style={S.companyContact}>
                {'RIF: J-000000000-0  ·  Tel: +58 212 000 0000\ncontacto@emporium.com  ·  www.emporium.com'}
              </Text>
            </View>

            {/* Right: FACTURA + number + estado */}
            <View style={S.invoiceTitleBlock}>
              <Text style={S.invoiceWordLabel}>FACTURA</Text>
              <Text style={S.invoiceNumberBig}>{f.numero}</Text>
              <View style={[S.estadoBadge, { backgroundColor: estadoCfg.bg }]}>
                <Text style={[S.estadoBadgeText, { color: estadoCfg.color }]}>
                  {estadoCfg.label}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Blue accent stripe */}
        <View style={S.accentStripe} />

        {/* ══ BODY ══ */}
        <View style={S.body}>

          {/* ── Meta: dates + client ── */}
          <View style={S.metaRow}>

            {/* Dates card */}
            <View style={S.metaCard}>
              <Text style={S.metaCardTitle}>Información de Factura</Text>
              <View style={S.metaItem}>
                <Text style={S.metaLabel}>Número</Text>
                <Text style={S.metaValueAccent}>{f.numero}</Text>
              </View>
              <View style={S.metaItem}>
                <Text style={S.metaLabel}>Fecha de Emisión</Text>
                <Text style={S.metaValue}>{fmtDate(f.fecha_emision)}</Text>
              </View>
              <View style={S.metaItem}>
                <Text style={S.metaLabel}>Fecha de Vencimiento</Text>
                <Text style={S.metaValue}>{fmtDate(f.fecha_vencimiento)}</Text>
              </View>
              {f.vendedor && (
                <View style={S.metaItem}>
                  <Text style={S.metaLabel}>Vendedor</Text>
                  <Text style={S.metaValue}>{f.vendedor.nombre}</Text>
                </View>
              )}
            </View>

            {/* Client card */}
            <View style={S.metaCard}>
              <Text style={S.metaCardTitle}>Cliente</Text>
              <Text style={[S.metaValueAccent, { marginBottom: 6 }]}>
                {f.cliente?.nombre ?? '—'}
              </Text>
              {f.cliente?.rif && (
                <View style={S.metaItem}>
                  <Text style={S.metaLabel}>RIF / Cédula</Text>
                  <Text style={S.metaValue}>{f.cliente.rif}</Text>
                </View>
              )}
              {f.cliente?.telefono && (
                <View style={S.metaItem}>
                  <Text style={S.metaLabel}>Teléfono</Text>
                  <Text style={S.metaValue}>{f.cliente.telefono}</Text>
                </View>
              )}
              {f.cliente?.email && (
                <View style={S.metaItem}>
                  <Text style={S.metaLabel}>Email</Text>
                  <Text style={S.metaValue}>{f.cliente.email}</Text>
                </View>
              )}
              {f.cliente?.direccion && (
                <View style={[S.metaItem, { marginTop: 2 }]}>
                  <Text style={S.metaLabel}>Dirección</Text>
                  <Text style={[S.metaValue, { flex: 1, textAlign: 'right' }]}>
                    {f.cliente.direccion}{f.cliente.ciudad ? `, ${f.cliente.ciudad}` : ''}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* ── Items table ── */}
          <Text style={S.tableSectionTitle}>Detalle de Artículos</Text>
          <View style={S.tableWrapper}>
            {/* Header */}
            <View style={S.tableHeader}>
              <Text style={[S.thCell, S.cDesc]}>Descripción</Text>
              <Text style={[S.thCell, S.cQty]}>Cant.</Text>
              <Text style={[S.thCell, S.cPrice]}>Precio Unit.</Text>
              <Text style={[S.thCell, S.cDisc]}>Desc.</Text>
              <Text style={[S.thCell, S.cSub]}>Subtotal</Text>
            </View>

            {/* Rows */}
            {(!f.items || f.items.length === 0) ? (
              <View style={[S.tableRow, { justifyContent: 'center' }]}>
                <Text style={S.tdCellMuted}>Sin artículos registrados</Text>
              </View>
            ) : (
              f.items.map((item, index) => (
                <View key={item.id} style={[S.tableRow, index % 2 === 1 ? S.tableRowAlt : {}]}>
                  <Text style={[S.tdCell, S.cDesc]}>{item.descripcion}</Text>
                  <Text style={[S.tdCell, S.cQty]}>{item.cantidad}</Text>
                  <Text style={[S.tdCellMuted, S.cPrice]}>{fmtCurrency(item.precio_unitario)}</Text>
                  <Text style={[S.tdCellMuted, S.cDisc]}>
                    {item.descuento > 0 ? `${item.descuento}%` : '—'}
                  </Text>
                  <Text style={[S.tdCell, S.cSub]}>{fmtCurrency(item.subtotal)}</Text>
                </View>
              ))
            )}
          </View>

          {/* ── Totals ── */}
          <View style={S.totalsRow}>
            <View style={S.totalsBox}>
              <View style={S.tRow}>
                <Text style={S.tLabel}>Subtotal</Text>
                <Text style={S.tValue}>{fmtCurrency(f.subtotal)}</Text>
              </View>
              {f.descuento > 0 && (
                <View style={S.tRow}>
                  <Text style={S.tLabel}>Descuento</Text>
                  <Text style={[S.tValue, { color: C.red }]}>− {fmtCurrency(f.descuento)}</Text>
                </View>
              )}
              <View style={S.tRow}>
                <Text style={S.tLabel}>Base Imponible</Text>
                <Text style={S.tValue}>{fmtCurrency(f.base_imponible)}</Text>
              </View>
              <View style={S.tRow}>
                <Text style={S.tLabel}>IVA ({tasaImpuesto}%)</Text>
                <Text style={S.tValue}>{fmtCurrency(f.impuesto)}</Text>
              </View>
              <View style={S.tRowTotal}>
                <Text style={S.tLabelTotal}>TOTAL</Text>
                <Text style={S.tValueTotal}>{fmtCurrency(f.total)}</Text>
              </View>
              {f.monto_pagado > 0 && (
                <View style={[S.tRow, { borderBottomWidth: 0 }]}>
                  <Text style={S.tLabel}>Abonado</Text>
                  <Text style={[S.tValue, { color: C.green }]}>{fmtCurrency(f.monto_pagado)}</Text>
                </View>
              )}
              <View style={S.tRowSaldo}>
                <Text style={S.tLabelSaldo}>Saldo Pendiente</Text>
                <Text style={S.tValueSaldo}>{fmtCurrency(saldo)}</Text>
              </View>
            </View>
          </View>

          {/* ── Notes ── */}
          {f.notas && (
            <View style={S.notesBox}>
              <Text style={S.notesTitle}>Observaciones</Text>
              <Text style={S.notesText}>{f.notas}</Text>
            </View>
          )}

          {/* ── Legal note ── */}
          <Text style={{ fontSize: 7, color: C.textMuted, textAlign: 'center', marginTop: 8 }}>
            Este documento es válido como comprobante de transacción comercial.
            {'  '}EMPORIUM Distribución Comercial · RIF J-000000000-0
          </Text>
        </View>

        {/* ══ FOOTER BAND ══ */}
        <View style={S.footer} fixed>
          <Text style={S.footerText}>Generado el {fmtDate(new Date().toISOString())}</Text>
          <Text style={S.footerMid}>EMPORIUM · {f.numero}</Text>
          <Text style={S.footerText}>Gracias por su preferencia</Text>
        </View>

      </Page>
    </Document>
  )
}
