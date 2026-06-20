# GENIE Coin — White Paper v2.0

## The AI Coin That Makes Millionaires

*"Fill the Lamp. The Genie Agent makes a millionaire. Then it does it again."*

GENIE is where crypto meets AI. Every buy and sell pays a small fee, and 100% of those fees flow into the **Magic Lamp** wallet. When the Lamp reaches **$1,000,000**, an autonomous AI — the **Genie Agent** — sends the entire amount to one random holder, turning them into a millionaire. Then the Lamp refills, and it happens again.

There is no team treasury. The fees go out. Every time the Lamp fills, a new millionaire is made.

Our goal is simple and bold: to become **the coin that makes the most millionaires in the world.**

### AT A GLANCE

| | |
|---|---|
| Token | GENIE |
| Supply | 500,000,000,000,000 (500 trillion) |
| Decimals | 18 |
| Buy / sell tax | 5% / 5% — hardcoded, immutable |
| Wallet transfers | 0% fee |
| Network | Ethereum |
| DEX | Uniswap |
| Payout milestone | Lamp reaches $1,000,000 |
| Who pays out | The Genie Agent (autonomous AI) |

---

### THE MECHANISM

1. A buyer or seller trades GENIE on Uniswap.
2. The contract collects a 5% fee in GENIE on each side.
3. Once ~1 trillion GENIE has accumulated (~0.2% of supply), the next sell triggers an auto-swap; the collected fees are converted and forwarded to the Magic Lamp wallet.
4. The **Genie Agent** watches the Lamp. The moment its value reaches **$1,000,000**, the Agent picks one holder at random and sends them the full amount.
5. The Lamp refills from new fees, and the cycle repeats — forever.

*No daily timer, no human pressing the button. The Lamp fills as the community trades; when it reaches the milestone, the Agent acts.*

### THE GENIE AGENT — AI AT THE CORE

The Genie Agent is what makes GENIE an AI coin: an autonomous agent that operates the Magic Lamp.

- It continuously monitors the Lamp's value.
- At the **$1,000,000** milestone, it autonomously selects one holder at random and transfers the funds.
- No admin chooses the winner — the Agent does.

A memecoin whose payouts are executed by an AI, not by a person: that is the Crypto × AI bet at the heart of GENIE.

> *Implementation specifics — how the Agent sources randomness, how its wallet key is secured, and how each payout can be independently verified — are **[to be detailed at launch]**. We would rather state this plainly than overclaim.*

### TOKENOMICS

| | |
|---|---|
| Total supply | 500,000,000,000,000 GENIE (500T) |
| Initial liquidity | Owner-funded at launch |
| Team allocation | None |
| Presale | None |
| Vesting | None |
| Buy tax | 5% — Solidity constant |
| Sell tax | 5% — Solidity constant |
| Wallet transfers | 0% |
| Fee destination | 100% → Magic Lamp |

### TRUST MODEL

- **Fees are immutable.** BUY_FEE and SELL_FEE are Solidity constants. No owner function exists to change them, ever.
- **No mint, no blacklist.** The full supply is minted once in the constructor. The owner cannot mint, freeze, or deny any address.
- **Immutable plumbing.** Router and trading-pair addresses are set at deploy and cannot be redirected.
- **Self-rug guard.** The owner rescue function explicitly refuses to withdraw GENIE from the contract, so accumulated fees stay on their path to the Lamp.
- **One-way launch protections.** The trading gate, 1% max-tx, and 1% max-wallet can be lifted by the owner exactly once. The max-wallet limit does not apply to sells, so holders can always exit.

### THE HONEST TRADE-OFF

The Magic Lamp is operated by the Genie Agent, and like any wallet it has a key that must be held somewhere. We will not pretend that away.

- **The fee cannot change.** Hardcoded at 5%, it leaves the contract on every auto-swap. Nobody can raise it, lower it, or skim above it.
- **Every payout is public.** The Lamp wallet and each payout transaction will be published, so anyone can verify every millionaire on-chain.
- **What is still being finalized.** The custody of the Agent's key, its randomness source, and its verification method are **[to be detailed at launch]**.

### CONTRACT

| | |
|---|---|
| Contract address | [to be filled at launch] |
| Magic Lamp wallet | [to be filled at launch] |
| Genie Agent | [to be detailed at launch] |
| Etherscan | [link to be filled at launch] |
| LP lock | [link to be filled at launch] |

---

*GENIE Coin · White Paper v2.0*
