'use client'

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
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

// ─── Styles ─────────────────────────────────────────────────────────────────

const colors = {
  primary: '#4f46e5',   // indigo-600
  primaryDark: '#3730a3',
  accent: '#e0e7ff',    // indigo-100
  text: '#1e293b',      // slate-900
  textMuted: '#64748b', // slate-500
  border: '#e2e8f0',    // slate-200
  bg: '#f8fafc',        // slate-50
  white: '#ffffff',
  green: '#16a34a',
  orange: '#ea580c',
  red: '#dc2626',
}

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: colors.text,
    backgroundColor: colors.white,
    padding: 40,
    lineHeight: 1.4,
  },

  // ── Header ──
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
    paddingBottom: 20,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  companyBlock: {
    flex: 1,
  },
  companyName: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    letterSpacing: 0.5,
  },
  companySubtitle: {
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  companyDetails: {
    marginTop: 6,
    fontSize: 9,
    color: colors.textMuted,
    lineHeight: 1.5,
  },
  invoiceBlock: {
    alignItems: 'flex-end',
  },
  invoiceLabel: {
    fontSize: 22,
    fontFamily: 'Helvetica-Bold',
    color: colors.text,
    letterSpacing: 0.5,
  },
  invoiceNumber: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    marginTop: 4,
  },
  invoiceBadge: {
    marginTop: 6,
    backgroundColor: colors.accent,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  invoiceBadgeText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // ── Meta row (dates + client) ──
  metaSection: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  metaBox: {
    flex: 1,
    backgroundColor: colors.bg,
    borderRadius: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metaBoxTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  metaLabel: {
    fontSize: 9,
    color: colors.textMuted,
  },
  metaValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.text,
  },
  metaValueLarge: {
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
    color: colors.text,
  },

  // ── Items Table ──
  tableSection: {
    marginBottom: 20,
  },
  tableTitle: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    borderRadius: 4,
    paddingVertical: 7,
    paddingHorizontal: 10,
    marginBottom: 1,
  },
  tableHeaderCell: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.white,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tableRowAlt: {
    backgroundColor: colors.bg,
  },
  tableCell: {
    fontSize: 9,
    color: colors.text,
  },
  tableCellMuted: {
    fontSize: 9,
    color: colors.textMuted,
  },

  // Column widths
  colDesc: { flex: 4 },
  colQty: { flex: 1, textAlign: 'right' },
  colPrice: { flex: 2, textAlign: 'right' },
  colDisc: { flex: 1, textAlign: 'right' },
  colSub: { flex: 2, textAlign: 'right' },

  // ── Totals ──
  totalsSection: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 24,
  },
  totalsBox: {
    width: 220,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    overflow: 'hidden',
  },
  totalsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  totalsLabel: {
    fontSize: 9,
    color: colors.textMuted,
  },
  totalsValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.text,
  },
  totalsRowTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: colors.primary,
  },
  totalsLabelTotal: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.white,
  },
  totalsValueTotal: {
    fontSize: 11,
    fontFamily: 'Helvetica-Bold',
    color: colors.white,
  },
  totalsRowSaldo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: colors.accent,
  },
  saldoLabel: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
  },
  saldoValue: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
    color: colors.primary,
  },

  // ── Notes + Footer ──
  notesSection: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: colors.bg,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.border,
  },
  notesTitle: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  notesText: {
    fontSize: 9,
    color: colors.text,
    lineHeight: 1.5,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 8,
    color: colors.textMuted,
  },
  footerBold: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    color: colors.textMuted,
  },
})

// ─── Component ───────────────────────────────────────────────────────────────

interface FacturaPDFProps {
  factura: Factura
}

export default function FacturaPDF({ factura }: FacturaPDFProps) {
  const f = factura
  const tasaImpuesto = f.tasa_impuesto ?? 16
  const saldo = (f.total ?? 0) - (f.monto_pagado ?? 0)

  const ESTADO_LABELS: Record<string, string> = {
    emitida: 'EMITIDA',
    pagada: 'PAGADA',
    anulada: 'ANULADA',
    con_nota_credito: 'CON NOTA DE CRÉDITO',
  }

  return (
    <Document
      title={`Factura ${f.numero}`}
      author="EMPORIUM - Distribución"
      subject={`Factura ${f.numero} - ${f.cliente?.nombre ?? ''}`}
    >
      <Page size="A4" style={styles.page}>

        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.companyBlock}>
            <Text style={styles.companyName}>EMPORIUM</Text>
            <Text style={styles.companySubtitle}>Distribución Comercial</Text>
            <Text style={styles.companyDetails}>
              {'RIF: J-000000000-0\nTel: +58 212 000 0000\ncontacto@emporium.com'}
            </Text>
          </View>
          <View style={styles.invoiceBlock}>
            <Text style={styles.invoiceLabel}>FACTURA</Text>
            <Text style={styles.invoiceNumber}>{f.numero}</Text>
            <View style={styles.invoiceBadge}>
              <Text style={styles.invoiceBadgeText}>
                {ESTADO_LABELS[f.estado] ?? f.estado.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        {/* ── Dates + Client ── */}
        <View style={styles.metaSection}>
          {/* Dates */}
          <View style={styles.metaBox}>
            <Text style={styles.metaBoxTitle}>Información de Factura</Text>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Fecha de Emisión</Text>
              <Text style={styles.metaValue}>{fmtDate(f.fecha_emision)}</Text>
            </View>
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Fecha de Vencimiento</Text>
              <Text style={styles.metaValue}>{fmtDate(f.fecha_vencimiento)}</Text>
            </View>
            {f.vendedor && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Vendedor</Text>
                <Text style={styles.metaValue}>{f.vendedor.nombre}</Text>
              </View>
            )}
          </View>

          {/* Client */}
          <View style={styles.metaBox}>
            <Text style={styles.metaBoxTitle}>Cliente</Text>
            <Text style={[styles.metaValueLarge, { marginBottom: 4 }]}>
              {f.cliente?.nombre ?? '—'}
            </Text>
            {f.cliente?.rif && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>RIF</Text>
                <Text style={styles.metaValue}>{f.cliente.rif}</Text>
              </View>
            )}
            {f.cliente?.telefono && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Teléfono</Text>
                <Text style={styles.metaValue}>{f.cliente.telefono}</Text>
              </View>
            )}
            {f.cliente?.email && (
              <View style={styles.metaRow}>
                <Text style={styles.metaLabel}>Email</Text>
                <Text style={styles.metaValue}>{f.cliente.email}</Text>
              </View>
            )}
            {f.cliente?.direccion && (
              <View style={[styles.metaRow, { marginTop: 2 }]}>
                <Text style={styles.metaLabel}>Dirección</Text>
                <Text style={[styles.metaValue, { flex: 1, textAlign: 'right' }]}>
                  {f.cliente.direccion}
                  {f.cliente.ciudad ? `, ${f.cliente.ciudad}` : ''}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Items Table ── */}
        <View style={styles.tableSection}>
          <Text style={styles.tableTitle}>Detalle de Artículos</Text>

          {/* Table header */}
          <View style={styles.tableHeader}>
            <Text style={[styles.tableHeaderCell, styles.colDesc]}>Descripción</Text>
            <Text style={[styles.tableHeaderCell, styles.colQty]}>Cant.</Text>
            <Text style={[styles.tableHeaderCell, styles.colPrice]}>Precio Unit.</Text>
            <Text style={[styles.tableHeaderCell, styles.colDisc]}>Desc.</Text>
            <Text style={[styles.tableHeaderCell, styles.colSub]}>Subtotal</Text>
          </View>

          {/* Rows */}
          {(!f.items || f.items.length === 0) ? (
            <View style={[styles.tableRow]}>
              <Text style={[styles.tableCellMuted, { flex: 1, textAlign: 'center' }]}>
                Sin artículos
              </Text>
            </View>
          ) : (
            f.items.map((item, index) => (
              <View
                key={item.id}
                style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
              >
                <Text style={[styles.tableCell, styles.colDesc]}>{item.descripcion}</Text>
                <Text style={[styles.tableCell, styles.colQty]}>{item.cantidad}</Text>
                <Text style={[styles.tableCell, styles.colPrice]}>
                  {fmtCurrency(item.precio_unitario)}
                </Text>
                <Text style={[styles.tableCellMuted, styles.colDisc]}>
                  {item.descuento > 0 ? `${item.descuento}%` : '—'}
                </Text>
                <Text style={[styles.tableCell, styles.colSub]}>
                  {fmtCurrency(item.subtotal)}
                </Text>
              </View>
            ))
          )}
        </View>

        {/* ── Totals ── */}
        <View style={styles.totalsSection}>
          <View style={styles.totalsBox}>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Subtotal</Text>
              <Text style={styles.totalsValue}>{fmtCurrency(f.subtotal)}</Text>
            </View>
            {f.descuento > 0 && (
              <View style={styles.totalsRow}>
                <Text style={styles.totalsLabel}>Descuento</Text>
                <Text style={[styles.totalsValue, { color: colors.red }]}>
                  - {fmtCurrency(f.descuento)}
                </Text>
              </View>
            )}
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Base Imponible</Text>
              <Text style={styles.totalsValue}>{fmtCurrency(f.base_imponible)}</Text>
            </View>
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>IVA ({tasaImpuesto}%)</Text>
              <Text style={styles.totalsValue}>{fmtCurrency(f.impuesto)}</Text>
            </View>
            <View style={styles.totalsRowTotal}>
              <Text style={styles.totalsLabelTotal}>TOTAL</Text>
              <Text style={styles.totalsValueTotal}>{fmtCurrency(f.total)}</Text>
            </View>
            {f.monto_pagado > 0 && (
              <View style={[styles.totalsRow, { borderBottomWidth: 0 }]}>
                <Text style={styles.totalsLabel}>Monto Pagado</Text>
                <Text style={[styles.totalsValue, { color: colors.green }]}>
                  {fmtCurrency(f.monto_pagado)}
                </Text>
              </View>
            )}
            <View style={styles.totalsRowSaldo}>
              <Text style={styles.saldoLabel}>Saldo Pendiente</Text>
              <Text style={styles.saldoValue}>{fmtCurrency(saldo)}</Text>
            </View>
          </View>
        </View>

        {/* ── Notes ── */}
        {f.notas && (
          <View style={styles.notesSection}>
            <Text style={styles.notesTitle}>Notas</Text>
            <Text style={styles.notesText}>{f.notas}</Text>
          </View>
        )}

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generado por EMPORIUM · {fmtDate(new Date().toISOString())}
          </Text>
          <Text style={styles.footerBold}>{f.numero}</Text>
          <Text style={styles.footerText}>
            Gracias por su preferencia
          </Text>
        </View>

      </Page>
    </Document>
  )
}
