/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Credit — client credit line management.
 *
 * Two separate concepts on the clientes row:
 *   • credito_usado — how much of limite_credito is currently committed
 *   • deuda_total   — outstanding invoice balance (gross, including paid)
 *
 * When a pedido is placed on credit:         credito_usado += total
 * When a factura is paid:                    credito_usado -= monto
 * When a factura is issued:                  deuda_total   += total
 * When a nota de crédito is issued:          deuda_total   -= total
 *                                            credito_usado -= total (if credito sale)
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type DeudaAction = 'add' | 'subtract'

/**
 * Atomically adjust clientes.deuda_total. Best-effort — logs on failure but
 * never throws, so a ledger-adjacent error never blocks a ship/bill op.
 */
export async function updateClienteDeuda(
  supabase: any,
  clienteId: string,
  amount: number,
  action: DeudaAction,
): Promise<void> {
  try {
    const { data: c } = await supabase
      .from('clientes')
      .select('deuda_total')
      .eq('id', clienteId)
      .maybeSingle()

    if (!c) return

    const current = Number(c.deuda_total ?? 0)
    const delta   = Math.abs(Number(amount) || 0)
    const next    = action === 'add'
      ? current + delta
      : Math.max(0, current - delta)

    await supabase
      .from('clientes')
      .update({ deuda_total: next, updated_at: new Date().toISOString() })
      .eq('id', clienteId)
  } catch (err) {
    console.error('[credito] updateClienteDeuda failed:', err)
  }
}

/**
 * Check whether a cliente has enough remaining credit to cover `amount`.
 * Returns `{ ok: true }` or `{ ok: false, reason, disponible }`.
 *
 * A cliente with credito_autorizado=false is always rejected, regardless of
 * limite_credito.
 */
export async function canExtendCredit(
  supabase: any,
  clienteId: string,
  amount: number,
): Promise<
  | { ok: true; disponible: number }
  | { ok: false; reason: string; disponible: number }
> {
  const { data: c } = await supabase
    .from('clientes')
    .select('credito_autorizado, limite_credito, credito_usado')
    .eq('id', clienteId)
    .maybeSingle()

  if (!c) {
    return { ok: false, reason: 'Cliente no encontrado', disponible: 0 }
  }
  if (!c.credito_autorizado) {
    return {
      ok: false,
      reason: 'El cliente no tiene crédito autorizado',
      disponible: 0,
    }
  }

  const limite = Number(c.limite_credito ?? 0)
  const usado  = Number(c.credito_usado ?? 0)
  const disponible = Math.max(0, limite - usado)

  if (Number(amount) > disponible) {
    return {
      ok: false,
      reason: `El monto ($${Number(amount).toFixed(2)}) excede el crédito disponible ($${disponible.toFixed(2)})`,
      disponible,
    }
  }
  return { ok: true, disponible }
}

/**
 * Consume (`add`) or release (`subtract`) the cliente's credit line.
 * Best-effort — logs on failure. Prefer the `usar_credito`/`liberar_credito`
 * RPCs when available.
 */
export async function adjustCreditoUsado(
  supabase: any,
  clienteId: string,
  amount: number,
  action: DeudaAction,
): Promise<void> {
  try {
    const rpcName = action === 'add' ? 'usar_credito' : 'liberar_credito'
    const { error } = await supabase.rpc(rpcName, {
      p_cliente_id: clienteId,
      p_monto: Math.abs(Number(amount) || 0),
    })
    if (!error) return
  } catch {
    /* RPC may not exist in older installs — fall through */
  }

  // Fallback: direct column update
  try {
    const { data: c } = await supabase
      .from('clientes')
      .select('credito_usado')
      .eq('id', clienteId)
      .maybeSingle()
    if (!c) return

    const current = Number(c.credito_usado ?? 0)
    const delta   = Math.abs(Number(amount) || 0)
    const next    = action === 'add'
      ? current + delta
      : Math.max(0, current - delta)

    await supabase
      .from('clientes')
      .update({ credito_usado: next })
      .eq('id', clienteId)
  } catch (err) {
    console.error('[credito] adjustCreditoUsado fallback failed:', err)
  }
}
