# Spec — customer-balance-display (new capability)

RFC-2119. Cada scenario MUST estar cubierto por al menos un test Vitest + Testing Library
(o, para los de tipo, por `npm run typecheck`) — verificable en `sdd-verify`.
Capability nueva: se documenta completa, no delta.

**Vocabulario** (el mismo del BE, `domain/entities/customer.ts:25-57`):

| Valor de `balanceDue` | Significado | NUNCA significa |
|---|---|---|
| `null` / ausente | Sin dato verificado (sin `grClienteId`, o nunca sincronizado) | "no debe nada" |
| `0` | Cero medido: el cliente no debe | "no sabemos" |
| `> 0` | Deuda real, en pesos | — |
| `< 0` | Saldo a favor (crédito) del cliente | una deuda |

`balanceStale === true` = el dato es más viejo que el TTL **de su carril** (rápido ~60min,
bajas 26h). El FE **MUST NOT** recalcular staleness: consume el booleano tal cual.

---

## Capability: contrato de tipos con el BE

### Requirement: TYPE-1 — `Customer` refleja el contrato REAL de `GET /api/clients/:id`
`src/types/customer.ts` MUST declarar `balanceStale?: boolean` y MUST NOT declarar
`balanceOverdue` ni `invoicesQty`. Esos dos campos no existen en la entidad del BE
(`domain/entities/customer.ts`) ni los emite el mapper (`toCustomer()`), y la ruta
responde la entidad cruda (`res.json(customer)`) — declararlos hacía que TypeScript
bendijera ramas de UI inalcanzables. `balanceCurrency` MUST NOT agregarse (hoy sólo vale
`'ARS' | null`, sintetizado por el parser del BE, sin valor para el usuario).

#### Scenario: el shape real del BE typechequea y renderiza
- **GIVEN** un fixture calcado de la respuesta real de `GET /api/clients/:id`, con
  `balanceDue` numérico, `balanceStale`, `lastBalanceAt` y `balanceCurrency: 'ARS'`
- **WHEN** se tipa como `Customer` y se pasa a `InfoTab`
- **THEN** `tsc --noEmit` pasa y el componente renderiza sin warnings

#### Scenario: `balanceDue: null` es parte del contrato
- **GIVEN** el mismo fixture con `balanceDue: null`, `balanceCurrency: null`,
  `lastBalanceAt: null`, `balanceStale: true` (el shape exacto de un cliente sin
  `grClienteId`)
- **WHEN** se tipa como `Customer`
- **THEN** `tsc --noEmit` pasa — `null` es un valor legítimo del campo, no un borde

#### Scenario: `balanceDue` negativo es parte del contrato
- **GIVEN** el fixture con `balanceDue: -5000` (saldo a favor: el parser del BE preserva
  el signo, `parseGrDebtStrict` sólo rechaza no-finitos y formatos ambiguos)
- **WHEN** se tipa como `Customer`
- **THEN** `tsc --noEmit` pasa

#### Scenario: los campos muertos ya no son asignables
- **GIVEN** un objeto `Customer` al que se le agrega `balanceOverdue: 30000`
- **WHEN** se compila con `// @ts-expect-error` sobre esa propiedad
- **THEN** `tsc --noEmit` pasa — lo que prueba que el campo **fue rechazado**; si alguien
  lo re-agrega al tipo, el `@ts-expect-error` queda sin usar y el typecheck FALLA

#### Scenario: cero referencias residuales en el código
- **GIVEN** el árbol `src/` completo
- **WHEN** se busca `balanceOverdue` o `invoicesQty`
- **THEN** no hay ninguna ocurrencia (ni tipo, ni rama de render, ni test, ni CSS)

---

## Capability: BalanceCard (`InfoTab`) — 4 estados excluyentes

### Requirement: CARD-1 — sin dato NO es "sin deuda"
La `BalanceCard` MUST renderizar un estado **"Saldo no disponible"** cuando
`balanceDue` es `null` o está ausente, siguiendo el patrón ya probado en
`FinancialSection.tsx:54-58` (`—` + label secundario). MUST NOT renderizar "Sin deuda",
el check verde, el badge "Deudor" ni monto alguno en ese estado.

#### Scenario: `balanceDue: null` muestra "no disponible"
- **GIVEN** un `Customer` con `balanceDue: null`
- **WHEN** se renderiza `InfoTab`
- **THEN** se ve "Saldo no disponible" y NO se ve "Sin deuda", ni "Deudor", ni un monto

#### Scenario: `balanceDue` ausente se comporta igual que `null`
- **GIVEN** un `Customer` sin la propiedad `balanceDue`
- **WHEN** se renderiza `InfoTab`
- **THEN** se ve "Saldo no disponible" (mismo estado, mismo testid)

#### Scenario: el estado no disponible explica el porqué
- **GIVEN** un `Customer` con `balanceDue: null`
- **WHEN** un lector de pantalla lee la card
- **THEN** el estado expone un texto accesible que dice que el dato no está disponible
  (no sólo el glifo `—`)

### Requirement: CARD-2 — cero medido, deuda y crédito son estados distintos
Con `balanceDue === 0` la card MUST mostrar "Sin deuda"; con `balanceDue > 0` MUST mostrar
el badge "Deudor" + el monto formateado en ARS; con `balanceDue < 0` MUST mostrar un
estado propio de **saldo a favor** con el monto en valor absoluto. El non-null assertion
`formatARS(balanceDue!)` MUST desaparecer — el estrechamiento tiene que salir del `if`.

#### Scenario: cero medido
- **GIVEN** un `Customer` con `balanceDue: 0`
- **WHEN** se renderiza `InfoTab`
- **THEN** se ve "Sin deuda" y NO se ve "Saldo no disponible" ni "Deudor"

#### Scenario: deuda
- **GIVEN** un `Customer` con `balanceDue: 65722.07`
- **WHEN** se renderiza `InfoTab`
- **THEN** se ve el badge "Deudor" y el monto formateado es-AR (contiene `65` `722` y `07`)

#### Scenario: saldo a favor no se confunde con "sin deuda" ni con deuda
- **GIVEN** un `Customer` con `balanceDue: -5000`
- **WHEN** se renderiza `InfoTab`
- **THEN** se ve un estado "Saldo a favor" con el monto `5.000` (valor absoluto), NO el
  badge "Deudor", y NO el texto "Sin deuda"

#### Scenario: los cuatro estados son mutuamente excluyentes
- **GIVEN** cada uno de los cuatro valores (`null`, `-5000`, `0`, `65722.07`)
- **WHEN** se renderiza `InfoTab` para cada uno
- **THEN** en cada render aparece exactamente UNO de los cuatro testids de estado

### Requirement: CARD-3 — frescura del dato: marca temporal y guard de fecha inválida
Con `lastBalanceAt` presente y parseable, la card MUST mostrar "Actualizado {relativo}"
con el timestamp absoluto en el `title`. `formatRelativeTime` MUST guardarse con
`Number.isFinite` sobre el timestamp parseado y devolver `null` ante una fecha inválida;
la card MUST omitir la marca en ese caso. Hoy una fecha inválida produce el literal
"hace NaN d" (`InfoTab.tsx:237-246`).

#### Scenario: marca relativa con fecha válida
- **GIVEN** un `Customer` con `lastBalanceAt` de hace 5 minutos
- **WHEN** se renderiza `InfoTab`
- **THEN** se ve un texto que empieza con "Actualizado hace"

#### Scenario: fecha inválida no imprime NaN
- **GIVEN** un `Customer` con `lastBalanceAt: 'no-es-una-fecha'`
- **WHEN** se renderiza `InfoTab`
- **THEN** NO aparece el texto "NaN" en ningún lado y la marca temporal se omite por
  completo (la card renderiza igual, sin crash)

#### Scenario: sin `lastBalanceAt` no hay marca
- **GIVEN** un `Customer` con `lastBalanceAt: null`
- **WHEN** se renderiza `InfoTab`
- **THEN** no se renderiza ninguna marca "Actualizado …"

#### Scenario: sin dato de saldo no hay marca de frescura, aunque `lastBalanceAt` esté presente
> Agregado (fix wave, 2026-08-11). El chip de stale (CARD-4) ya tenía el guard
> `state.kind !== 'unknown'`; la marca "Actualizado hace …" de al lado no lo tenía, y podía
> leerse "Saldo no disponible · Actualizado hace 2 h" — ¿actualizado QUÉ, si no hay saldo?
> El `lastBalanceAt` de un cliente sin `grClienteId` es la marca del último INTENTO, no de
> un saldo real.

- **GIVEN** un `Customer` con `balanceDue: null` y `lastBalanceAt` de hace 2 horas
- **WHEN** se renderiza `InfoTab`
- **THEN** se ve el estado "Saldo no disponible" y NO aparece ningún texto "Actualizado"

### Requirement: CARD-4 — `balanceStale` visible, con texto, y sin contradecir al estado
Con `balanceStale === true` **y** un `balanceDue` conocido, la card MUST mostrar un
indicador de dato desactualizado que incluya **texto** (no sólo color ni sólo icono). Con
`balanceStale === false` o ausente MUST NOT mostrarlo. Cuando `balanceDue == null` la card
MUST NOT mostrar el indicador de stale: no hay dato que pueda estar viejo, y mostrar los
dos mensajes juntos se contradice.

#### Scenario: dato viejo se avisa con texto
- **GIVEN** un `Customer` con `balanceDue: 1000` y `balanceStale: true`
- **WHEN** se renderiza `InfoTab`
- **THEN** se ve un indicador con texto legible (ej. "desactualizado") junto a la marca de
  frescura; el aviso NO depende exclusivamente del color

#### Scenario: dato fresco no molesta
- **GIVEN** un `Customer` con `balanceDue: 1000` y `balanceStale: false`
- **WHEN** se renderiza `InfoTab`
- **THEN** el indicador de desactualizado NO está presente

#### Scenario: `balanceStale` ausente se trata como fresco
- **GIVEN** un `Customer` sin la propiedad `balanceStale` (BE viejo o payload parcial)
- **WHEN** se renderiza `InfoTab`
- **THEN** el indicador NO está presente y la card no crashea

#### Scenario: sin dato no se avisa de dato viejo
- **GIVEN** un `Customer` con `balanceDue: null` y `balanceStale: true` (el caso real de
  un cliente sin `grClienteId`)
- **WHEN** se renderiza `InfoTab`
- **THEN** se ve "Saldo no disponible" y NO se ve el indicador de desactualizado

### Requirement: CARD-5 — el título de la card no presupone deuda
> Agregado (fix wave, 2026-08-11). El título literal "Saldo deudor" coronaba un CRÉDITO
> ("Saldo deudor / A favor $ 5.000") y un cero medido con la palabra "deudor". La
> `BalanceCard` MUST usar un título neutro por TODOS los estados — "Saldo de la cuenta", el
> mismo rótulo que ya usa el sub-header de `CustomerDetailPage` (HEADER-1) — para que el
> operador lea el mismo nombre para el mismo dato en los dos lugares. El badge "Deudor"
> sigue siendo la única marca del estado de deuda.

#### Scenario: con un crédito el título no dice "deudor"
- **GIVEN** un `Customer` con `balanceDue: -5000`
- **WHEN** se renderiza `InfoTab`
- **THEN** NO se ve el texto "Saldo deudor" y el heading de la card dice "Saldo de la
  cuenta"

#### Scenario: con un cero medido el título tampoco dice "deudor"
- **GIVEN** un `Customer` con `balanceDue: 0`
- **WHEN** se renderiza `InfoTab`
- **THEN** NO se ve el texto "Saldo deudor"

#### Scenario: con deuda, "Deudor" aparece una sola vez
- **GIVEN** un `Customer` con `balanceDue: 65722.07`
- **WHEN** se renderiza `InfoTab`
- **THEN** el texto "Deudor" aparece exactamente UNA vez — el badge del estado, no el
  título

---

## Capability: saldo de la cuenta (sub-header de `CustomerDetailPage`)

### Requirement: HEADER-1 — `null` deja de pintarse `$ 0,00`
`formatBalance` (`CustomerDetailPage.tsx:28-31`) MUST NOT devolver `'$ 0,00'` para
`null`/`undefined`. El sub-header MUST renderizar un estado "no disponible" reusando el
atom `MaybeValue` (`src/components/atoms/MaybeValue`), que ya implementa `—` + `title` +
`aria-label` con la razón. La razón MUST explicar el porqué (cliente no vinculado a
Gestión Real o saldo nunca sincronizado).

#### Scenario: sin dato el sub-header no afirma cero
- **GIVEN** un `Customer` con `balanceDue: null`
- **WHEN** se renderiza `CustomerDetailPage`
- **THEN** en "Saldo de la cuenta" NO aparece `$ 0,00`; aparece el marcador de dato no
  disponible con su explicación accesible

#### Scenario: cero medido sí es cero
- **GIVEN** un `Customer` con `balanceDue: 0`
- **WHEN** se renderiza `CustomerDetailPage`
- **THEN** "Saldo de la cuenta" muestra un monto cero formateado, no el marcador de
  "no disponible"

#### Scenario: la razón del "no disponible" es la real, no el boilerplate
> Agregado (fix wave, 2026-08-11). "Dato no disponible" es el texto BOILERPLATE del atom
> `MaybeValue` — pasa con cualquier `unknownReason`, incluso vacío. Este scenario promete
> la RAZÓN concreta, igual que su gemelo de la card (CARD-1).

- **GIVEN** un `Customer` con `balanceDue: null`
- **WHEN** se renderiza `CustomerDetailPage`
- **THEN** el marcador de "no disponible" del sub-header tiene `title` y `aria-label` que
  mencionan la razón real (Gestión Real / sincronización), no sólo el boilerplate genérico

### Requirement: HEADER-2 — deuda y saldo a favor no pueden verse igual
El sub-header MUST distinguir deuda de crédito. Se conserva la convención vigente (una
deuda se muestra en negativo, `:187`), y el crédito MUST identificarse por **texto**
adicional, no sólo por color ni sólo por el signo. Hoy una deuda de 5.000 y un crédito de
5.000 renderizan ambos `-$ 5.000`.

#### Scenario: deuda se muestra en negativo
- **GIVEN** un `Customer` con `balanceDue: 5000`
- **WHEN** se renderiza `CustomerDetailPage`
- **THEN** el saldo se muestra en negativo (contiene `5.000` y el signo menos) y NO se
  etiqueta como saldo a favor

#### Scenario: crédito se etiqueta como saldo a favor
- **GIVEN** un `Customer` con `balanceDue: -5000`
- **WHEN** se renderiza `CustomerDetailPage`
- **THEN** el saldo aparece acompañado de un texto que lo identifica como saldo a favor, y
  su render es distinguible del caso de deuda por `5000` **sin depender del color**

#### Scenario: el cero medido no dice "a favor"
> Agregado (fix wave, 2026-08-11). Un saldo saldado (cero medido) no es un crédito.

- **GIVEN** un `Customer` con `balanceDue: 0`
- **WHEN** se renderiza `CustomerDetailPage`
- **THEN** el sub-header NO muestra el texto "a favor"

### Requirement: HEADER-3 — sin casts estructurales
`CustomerDetailPage` MUST leer `customer.balanceDue` directamente. El cast
`(customer as { balanceDue?: number | null }).balanceDue` (`:186`) MUST eliminarse: el
tipo ya declara el campo, y el cast anula el type-check ante un rename del BE (la clase de
bug que este change existe para no cometer).

#### Scenario: un rename del campo rompe el typecheck
- **GIVEN** el código de `CustomerDetailPage` sin el cast estructural
- **WHEN** se busca `as { balanceDue` en el archivo
- **THEN** no hay ninguna ocurrencia — el acceso es directo y `tsc --noEmit` lo cubre

### Requirement: HEADER-4 — el color del sub-header es por estado y consistente con la card
> Agregado (fix wave, 2026-08-11). El sub-header pintaba TODOS los estados con un único
> color hardcodeado (`#16a34a`, verde, 3.30:1 sobre blanco: FALLA AA) — incluida la deuda,
> del MISMO verde que el crédito. El valor del sub-header MUST tomar color POR ESTADO, con
> los MISMOS tokens que la `BalanceCard` del tab Información: deuda → `--badge-late-fg`,
> crédito y cero medido → `--badge-paid-fg`, sin dato → `--color-text-secondary`. El color
> es refuerzo: el canal informativo sigue siendo el texto (`—` / `$ 0,00` / `-$ 5.000` /
> "a favor").

#### Scenario: cada estado toma su clase de color y ninguna de las otras tres
- **GIVEN** los cuatro valores de `balanceDue` (`null`, `0`, `5000`, `-5000`)
- **WHEN** se renderiza `CustomerDetailPage` para cada uno
- **THEN** el valor del sub-header tiene la clase de tono correspondiente a su estado
  (unknown/settled/debt/credit) y NINGUNA de las otras tres

#### Scenario: la deuda no comparte clase con el crédito
- **GIVEN** un `Customer` con `balanceDue: 5000`
- **WHEN** se renderiza `CustomerDetailPage`
- **THEN** el valor del sub-header NO tiene la clase de tono del crédito (era el bug: los
  dos del mismo verde)

### Requirement: HEADER-5 — frescura visible en el sub-header
> Agregado (fix wave, 2026-08-11). El saldo MÁS visible de la página no tenía señal de
> frescura: un dato de 26h+ (el barrido de bajas) se presentaba idéntico a uno recién
> sincronizado. El sub-header MUST mostrar un chip "⚠ Desactualizado" (icono + TEXTO,
> reusando el patrón del chip de la `BalanceCard`, CARD-4) cuando `balanceStale === true` y
> hay un `balanceDue` conocido. Con `balanceDue == null` el chip MUST NOT mostrarse —
> mismo gate que CARD-4: no hay dato que pueda estar viejo, y el BE puede mandar
> `stale: true` permanente para un cliente sin `grClienteId`.

#### Scenario: dato desactualizado con saldo conocido muestra el chip con texto
- **GIVEN** un `Customer` con `balanceDue: 5000` y `balanceStale: true`
- **WHEN** se renderiza `CustomerDetailPage`
- **THEN** el sub-header muestra un chip cuyo texto matchea "desactualizado"

#### Scenario: dato fresco no muestra el chip
- **GIVEN** un `Customer` con `balanceDue: 5000` y `balanceStale: false`
- **WHEN** se renderiza `CustomerDetailPage`
- **THEN** el chip de desactualizado NO está presente

#### Scenario: `balanceStale` ausente se trata como fresco
- **GIVEN** un `Customer` con `balanceDue: 5000` sin la propiedad `balanceStale`
- **WHEN** se renderiza `CustomerDetailPage`
- **THEN** el chip NO está presente y la página no crashea

#### Scenario: sin dato no se avisa de dato viejo (mismo gate que la card)
- **GIVEN** un `Customer` con `balanceDue: null` y `balanceStale: true`
- **WHEN** se renderiza `CustomerDetailPage`
- **THEN** el chip de desactualizado NO está presente, y sí se ve el marcador de
  "no disponible"

#### Scenario: el crédito también avisa cuando está desactualizado
- **GIVEN** un `Customer` con `balanceDue: -5000` y `balanceStale: true`
- **WHEN** se renderiza `CustomerDetailPage`
- **THEN** el chip de desactualizado SÍ está presente (la clase, no la instancia)

---

## Capability: robustez del contexto de saldo del inbox

### Requirement: INBOX-1 — el último hop del acceso a `balance` es opcional
`useWhatsapp.ts:876` MUST encadenar opcionalmente el hop final
(`query.data?.client?.balance?.stale === true`). Hoy `?.client?.balance.stale` explota si
el BE devuelve un `client` sin `balance` (payload parcial / versión desalineada), y ese
throw ocurre en el cuerpo del hook, tirando el panel entero.

#### Scenario: `client` sin `balance` no rompe el hook
- **GIVEN** una respuesta de contexto de inbox con `client` presente pero sin `balance`
- **WHEN** se ejecuta `useInboxClientContext`
- **THEN** no se lanza ninguna excepción, `staleBalance` resuelve `false` y el query de
  refresco de balance NO se dispara

#### Scenario: `client` sin `balance` tampoco rompe a sus consumidores
> Agregado (fix wave, 2026-08-11). El `?.` de `useWhatsapp.ts:880` salvó el CUERPO del
> hook pero dejó a los CONSUMIDORES del mismo payload (`FinancialSection`,
> `TemplateSendPanel`) leyendo `balance.due` sin guard — explotaban con el fixture EXACTO
> del test de arriba. Fix de la CLASE, no la instancia.

- **GIVEN** un `client` presente pero SIN la propiedad `balance` (payload parcial del BE,
  deploy escalonado)
- **WHEN** se renderizan `FinancialSection` y `TemplateSendPanel` sobre ese contexto
- **THEN** ninguno de los dos lanza excepción; `FinancialSection` muestra "Saldo no
  disponible" sin afirmar "Al día" ni "Debe", y en `TemplateSendPanel` la fuente
  "Monto de deuda" queda deshabilitada mientras "Nombre del cliente" sigue habilitada

---

## Capability: no-regresión de los consumidores fuera de alcance

### Requirement: NOREG-1 — los otros consumidores de saldo no cambian de comportamiento
`FinancialSection`, `TemplateSendPanel` y `MisClientesPage` consumen DTOs **distintos** de
`Customer` y ya tratan el `null` como "sin dato". Este change MUST NOT alterar su
comportamiento observable.

#### Scenario: `FinancialSection` sigue honesto con `due: null`
- **GIVEN** un `WhatsappInboxClientSummary` con `balance.due: null`
- **WHEN** se renderiza `FinancialSection`
- **THEN** muestra "Saldo no disponible" y NO muestra "Al día" ni "Debe"

#### Scenario: `TemplateSendPanel` deshabilita "Monto de deuda" sin dato
- **GIVEN** un contexto de cliente con `balance.due: null`
- **WHEN** se abre el panel de envío por template
- **THEN** la opción de fuente "Monto de deuda" está deshabilitada (no resuelve a `""`
  silenciosamente en el mensaje enviado)

#### Scenario: `MisClientesPage` no depende de `Customer.balanceDue`
- **GIVEN** el código de `MisClientesPage`
- **WHEN** se busca `balanceDue`
- **THEN** no hay ocurrencias — su columna "Deuda" sale de `PortfolioItem.debtAmount`,
  otro endpoint y otro carril

---

## Capability: accesibilidad y sistema de diseño

### Requirement: A11Y-1 — tokens, contraste calculado y estado nunca sólo-color
Todas las reglas de la BalanceCard y del sub-header tocadas por este change MUST usar
tokens `var(--*)`. Los hex crudos existentes en `InfoTab.module.css:202-274` (`#fee2e2`,
`#991b1b`, `#dc2626`, `#dcfce7`, `#166534`, `#b91c1c`) MUST reemplazarse por sus tokens
equivalentes o eliminarse con su rama. Cada par color-texto/fondo introducido o migrado
MUST tener contraste **calculado** ≥ 4.5:1. Ningún estado (deuda / crédito / sin dato /
desactualizado) puede distinguirse **sólo** por color: cada uno MUST llevar texto o icono
propio.

#### Scenario: cero hex crudo en las reglas de balance
- **GIVEN** `InfoTab.module.css`
- **WHEN** se leen las declaraciones `color`/`background(-color)` de las reglas `.balance*`
- **THEN** ninguna contiene un literal `#RRGGBB`; todas referencian `var(--…)`

#### Scenario: contraste AA calculado sobre los tokens reales
- **GIVEN** los pares de color de los estados (deuda, crédito, sin dato, desactualizado)
  resueltos contra `src/tokens/variables.css`
- **WHEN** se calcula el ratio WCAG 2.1 a mano (molde
  `FinancialSection.contrast.test.tsx`)
- **THEN** cada par da ≥ 4.5:1

#### Scenario: el estado se lee sin color
- **GIVEN** los cuatro estados de la card renderizados
- **WHEN** se inspecciona el contenido textual de cada uno (ignorando estilos)
- **THEN** cada estado es identificable por su texto — el color es refuerzo, no el canal
