import type { ReactNode } from 'react'

function KbSection({
  id,
  title,
  children,
}: {
  id: string
  title: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="mb-3 border-b border-zinc-800 pb-2 text-sm font-semibold tracking-tight text-zinc-100">
        {title}
      </h2>
      <div className="space-y-3 text-[13px] leading-relaxed text-zinc-400">{children}</div>
    </section>
  )
}

function KbH3({ children }: { children: ReactNode }) {
  return <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</h3>
}

function KbUl({ children }: { children: ReactNode }) {
  return <ul className="list-disc space-y-1.5 pl-5 marker:text-zinc-600">{children}</ul>
}

function KbTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full min-w-[32rem] border-collapse text-left text-xs">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/80">
            {headers.map((h) => (
              <th key={h} className="px-3 py-2.5 font-semibold text-zinc-400">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, i) => (
            <tr key={i} className="border-b border-zinc-800/80 last:border-0">
              {cells.map((c, j) => (
                <td
                  key={j}
                  className={`px-3 py-2.5 align-top ${j === 0 ? 'font-medium text-zinc-300' : 'text-zinc-500'}`}
                >
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const TOC: { id: string; label: string }[] = [
  { id: 'kb-positions', label: 'Positional effectiveness' },
  { id: 'kb-breakers', label: 'Engine breakers' },
  { id: 'kb-cognitive', label: 'Cognitive synergy' },
  { id: 'kb-hidden', label: 'Hidden attributes' },
  { id: 'kb-freerole', label: 'Free role' },
  { id: 'kb-passing', label: 'Passing & split strategy' },
  { id: 'kb-wibwob', label: 'WibWob mastery' },
  { id: 'kb-instructions', label: 'Player instructions' },
  { id: 'kb-setpieces', label: 'Set pieces' },
  { id: 'kb-training', label: 'Training & coaching' },
  { id: 'kb-coach-reports', label: 'Coach reports' },
  { id: 'kb-board', label: 'Chairman / MD' },
]

export function MerlinKnowledgeBasePanel() {
  return (
    <div className="mx-auto max-w-4xl space-y-8 pb-12 pt-2">
      <header className="space-y-2 border-b border-zinc-800 pb-6">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">CM Merlin reference</p>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-100">
          Match Engine &amp; Tactical Knowledge Base
        </h1>
        <p className="text-sm text-zinc-500">
          Target system: <span className="text-zinc-400">Championship Manager 01/02</span>
        </p>
      </header>

      <nav className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Contents</p>
        <ol className="columns-1 gap-x-6 text-xs sm:columns-2">
          {TOC.map((item, i) => (
            <li key={item.id} className="mb-1.5 break-inside-avoid">
              <a href={`#${item.id}`} className="text-zinc-400 hover:text-emerald-200/90">
                {i + 1}. {item.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <KbSection id="kb-positions" title="1. Positional Effectiveness Matrix">
        <p>
          The CM 01/02 engine relies heavily on specific attribute combinations that break its 2D coordinate
          calculations. True effectiveness is measured by these critical combinations rather than overall Potential
          Ability (PA).
        </p>
        <KbTable
          headers={['Position', 'Engine breakers (aim 20+)', 'Critical secondary', 'Vital brain / hidden']}
          rows={[
            ['Goalkeepers (GK)', 'Handling, Reflexes', 'Agility, Positioning, Jumping', 'Consistency, Pressure'],
            ['Sweepers / Centre-Backs (SW/DC)', 'Positioning, Tackling, Jumping', 'Marking, Strength, Heading, Pace', 'Consistency, Concentration'],
            ['Full-Backs (DL/DR)', 'Positioning, Tackling, Pace', 'Crossing, Stamina, Acceleration', 'Work Rate, Consistency'],
            ['Defensive Midfielders (DMC)', 'Positioning, Work Rate, Tackling', 'Stamina, Passing, Strength', 'Determination, Teamwork'],
            ['Central Midfielders (MC)', 'Passing, Off the Ball', 'Stamina, Creativity, Decisions', 'Teamwork, Consistency'],
            ['Wide Midfielders (ML/MR)', 'Pace, Acceleration, Crossing', 'Dribbling, Passing, Off the Ball', 'Consistency, Flair'],
            ['Attacking Midfielders (AMC)', 'Off the Ball, Passing', 'Creativity, Technique, Dribbling', 'Decisions, Anticipation'],
            ['Forwards (FC)', 'Off the Ball, Creativity, Technique', 'Passing, Finishing, Dribbling', 'Decisions, Anticipation'],
            ['Strikers (SC)', 'Finishing, Off the Ball, Jumping, Pace', 'Acceleration, Anticipation, Heading', 'Consistency, Important Matches'],
          ]}
        />
      </KbSection>

      <KbSection id="kb-breakers" title="2. The Engine Breakers Explained">
        <p>These attributes exploit the mathematical limitations of the match engine.</p>
        <KbUl>
          <li>
            <strong className="font-medium text-zinc-300">Jumping (SC, DC):</strong> At 20, a player consistently wins
            aerial calculations on corners and crosses, overriding physical height.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Off the Ball (SC, AMC, MC):</strong> Dictates movement into
            empty coordinates; at 20 the player is practically unmarkable on the AI zonal grid.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Positioning (DC, DMC, GK):</strong> The inverse of Off the
            Ball — at 20 the defender occupies the correct coordinate to intercept or block, nullifying opposition pace.
          </li>
        </KbUl>
      </KbSection>

      <KbSection id="kb-cognitive" title='3. Cognitive Synergy (The "Xavi" Effect)'>
        <p>
          Players with average physicals can dominate through mental combinations that dictate smart plays and
          high-percentage actions.
        </p>
        <KbUl>
          <li>
            <strong className="font-medium text-zinc-300">Decisions:</strong> Picks the high-percentage pass over a
            low-percentage long shot.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Teamwork:</strong> Prioritises assisting a teammate over
            individual glory.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Anticipation:</strong> Reads Off the Ball movement before
            opposition Positioning registers the threat.
          </li>
        </KbUl>
      </KbSection>

      <KbSection id="kb-hidden" title="4. Hidden Attributes: Multipliers & Suppressors">
        <p>Hidden values (1–20) dictate how often a player actually utilises their visible attributes.</p>
        <KbUl>
          <li>
            <strong className="font-medium text-zinc-300">Consistency:</strong> Probability check on true CA each match;
            high consistency trumps high CA. Mental and technical attrs are penalised on off-days; physical attrs like
            Pace and Jumping are largely unaffected.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Important Matches:</strong> Temporary CA boost in cup finals,
            rivalries, and decisive games.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Dirtiness:</strong> With high Aggression, guarantees bookings
            and tactical disruption.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Injury Proneness:</strong> High values cause constant injuries;
            lack of match practice degrades attributes over time.
          </li>
        </KbUl>
      </KbSection>

      <KbSection id="kb-freerole" title="5. Tactical Instructions: The Free Role">
        <p>
          The Free Role untethers a player from the strict tactical grid (WibWob), allowing dynamic roaming based on
          attributes.
        </p>
        <KbUl>
          <li>
            <strong className="font-medium text-zinc-300">Match engine impact:</strong> Immunity to strict man-marking;
            offensive pockets of space; defensive bypass for counters.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Usage rule:</strong> Exactly one player (ideally elite AMC or
            FC). Multiple Free Roles destroy structure and congest coordinates.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Required attributes:</strong> Elite Off the Ball, Creativity,
            Decisions, Anticipation.
          </li>
        </KbUl>
      </KbSection>

      <KbSection id="kb-passing" title='6. Passing Instructions & The "Split" Strategy'>
        <KbUl>
          <li>
            <strong className="font-medium text-zinc-300">Short:</strong> Closest occupied coordinate — safe, struggles vs
            deep blocks without elite Off the Ball.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Direct:</strong> Vertical through-balls behind the line.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Mixed:</strong> Engine uses Decisions and Creativity to choose.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Team:</strong> Inherits global instructions.
          </li>
        </KbUl>
        <KbH3>Split passing setup</KbH3>
        <KbUl>
          <li>GK, DC, DMC, MC: Short/Team</li>
          <li>Full-backs / wing-backs: Mixed</li>
          <li>Wingers (AML/AMR): Direct</li>
          <li>AMC: Mixed</li>
          <li>Strikers (SC): Short</li>
        </KbUl>
      </KbSection>

      <KbSection id="kb-wibwob" title="7. WibWob (With Ball / Without Ball) Mastery">
        <KbH3>Stamina tax &amp; rubber-band effect</KbH3>
        <p>
          Stamina drain follows horizontal/vertical distance travelled the instant possession switches between With Ball
          and Without Ball screens. Keep far-side players anchored; use subtle ball-side shifts for triangles without the
          full-field sprint tax.
        </p>
        <KbH3>Engine exploits</KbH3>
        <KbUl>
          <li>
            <strong className="font-medium text-zinc-300">Node stacking:</strong> 2–3 attackers on the same pixel — one
            marker for multiple free runners.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Ghost run:</strong> MC deep on main screen, With Ball node in
            striker space — DMCs stop tracking.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Penalty box funnel:</strong> Pack DCs, DMCs, and wide players
            centrally on Without Ball to force crosses into 20 Jumping.
          </li>
        </KbUl>
        <KbH3>Do&apos;s and don&apos;ts</KbH3>
        <KbUl>
          <li>DO create stepped movements across possession zones.</li>
          <li>DO stagger stacked nodes by one pixel.</li>
          <li>DON&apos;T drag centre-backs wide on Without Ball.</li>
          <li>DON&apos;T ignore Positioning / Off the Ball (15+ for complex runs).</li>
        </KbUl>
      </KbSection>

      <KbSection id="kb-instructions" title="8. Player Instructions: Engine Overrides">
        <KbH3>Forward runs</KbH3>
        <p>
          Sprint into advanced coordinates — heavy stamina use. MC, wingers, attacking full-backs. Never on pure AMC
          playmakers or DMC/DC.
        </p>
        <KbH3>Run with ball</KbH3>
        <p>Wingers and elite AMCs. Not below 14 Dribbling; kills tempo in fast passing systems.</p>
        <KbH3>Try long shots</KbH3>
        <p>MC/AMC with 15+ Long Shots and high Decisions vs deep blocks. Never on main strikers or low Decisions.</p>
        <KbH3>Hold up ball</KbH3>
        <p>Lone strikers, target men. Ruins pacey poachers and fluid systems.</p>
        <KbH3>Cross ball</KbH3>
        <p>Wide midfielders, wingers, attacking full-backs — not inverted wingers driving inside.</p>
      </KbSection>

      <KbSection id="kb-setpieces" title="9. Set Piece Mechanics">
        <p>
          You cannot dictate where or how a set piece is taken — only the taker. Delivery is pure engine math.
        </p>
        <KbUl>
          <li>
            <strong className="font-medium text-zinc-300">Corners:</strong> Set Pieces, Crossing, Anticipation, hidden
            Corners. Near-post exploit: 20 Jumping CB on Go Forward.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Free kicks:</strong> Set Pieces, Technique (multiplier over the
            wall), Long Shots or Passing by type.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Penalties:</strong> Penalties, Finishing, Decisions — Pressure
            is critical under big games.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Throw-ins:</strong> Long Throws, Strength — full-backs or
            outer CBs, not attackers.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Stand with taker:</strong> Elite striker pulls best defenders
            out; your headers dominate the box.
          </li>
        </KbUl>
      </KbSection>

      <KbSection id="kb-training" title="10. The Training & Coaching Blueprint">
        <KbH3>Golden rule of intensity</KbH3>
        <p>
          Never use Intensive in the regular season — massive condition drops and injury spikes. Medium is optimal growth
          for almost every attribute; Intensive is pre-season only.
        </p>
        <KbH3>What categories develop</KbH3>
        <KbUl>
          <li>Fitness: Pace, Acceleration, Stamina, Strength, Agility, Jumping</li>
          <li>Tactics: Positioning, Off the Ball, Anticipation, Decisions, Teamwork</li>
          <li>Shooting: Finishing, Long Shots, Heading</li>
          <li>Skills: Passing, Tackling, Dribbling, Technique, Crossing, Marking</li>
          <li>Goalkeeping: Handling, Reflexes</li>
        </KbUl>
        <KbH3>Optimal positional schedules</KbH3>
        <KbTable
          headers={['Role', 'Schedule', 'Priority']}
          rows={[
            ['GK', 'GK Med, Fitness Med, Tactics Light', 'Reflexes, Handling; Light Tactics for Positioning upkeep'],
            ['DC / SW', 'Fitness Med, Tactics Med, Skills Med', 'Tactics + Skills; no Shooting/GK'],
            ['DMC / DL / DR', 'As DC + Shooting Light', 'Occasional long shots / crossing via Skills tie-in'],
            ['MC / AMC / ML / MR', 'All four outfield Med', 'Rounded Passing, Dribbling, Off the Ball, Long Shots'],
            ['SC / FC', 'Fitness Med, Shooting Med, Tactics Med, Skills Light', 'Pace, Finishing, Off the Ball; Light Skills for poachers'],
          ]}
        />
        <KbH3>Coaching allocations</KbH3>
        <p>Do not use Auto-Assign All — it dilutes coaches.</p>
        <KbUl>
          <li>Outfield schedules use Coaching Outfield Players as the core stat.</li>
          <li>Tactics category also checks each coach&apos;s Tactics attribute.</li>
          <li>Goalkeeping uses Coaching Goalkeepers only.</li>
          <li>2–3 elite coaches (15+) per schedule beats stacking six average ones.</li>
        </KbUl>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-zinc-500 marker:text-zinc-600">
          <li>GK schedule: 1–2 coaches with 15+ Coaching Goalkeepers, no other duties.</li>
          <li>Tactics: best minds with 15+ Outfield and 15+ Tactics.</li>
          <li>Fitness, Shooting, Skills: remaining 15+ Outfield coaches distributed evenly.</li>
        </ol>
      </KbSection>

      <KbSection id="kb-coach-reports" title="11. Decoding Coach Reports">
        <p>
          Coach reports are direct, literal translations of hidden mathematical calculations regarding Current Ability
          (CA) and Potential Ability (PA).
        </p>
        <p>
          <strong className="font-medium text-zinc-300">Golden rule:</strong> Never trust a coach report unless the coach
          has 15+ in <strong className="font-medium text-zinc-300">Judging Player Potential</strong> (youth) or 15+ in{' '}
          <strong className="font-medium text-zinc-300">Judging Player Ability</strong> (current starters).
        </p>
        <KbH3>&quot;Developing signs of becoming a great player&quot;</KbH3>
        <p>
          Exceptionally high PA ceiling (usually 150+ out of 200) with CA trending upward. Lock down a long contract;
          keep Medium training and give first-team minutes to close the CA–PA gap.
        </p>
        <KbH3>&quot;Playing well in training and should have an extended run in the first team&quot;</KbH3>
        <p>
          CA has jumped via training and now matches or beats your starters; hidden form is peaking. Give 3–5 consecutive
          starts (cups or easier league games). Beyond a threshold, growth needs competitive minutes — loan out if they
          cannot break into the XI.
        </p>
      </KbSection>

      <KbSection id="kb-board" title="12. Boardroom Dynamics: Chairman / Managing Director">
        <p>
          Managers cannot directly control or fire the Chairman or Managing Director, but this individual sets the
          club&apos;s financial and political reality through four hidden attributes on their{' '}
          <span className="font-mono text-zinc-500">nonplayer.dat</span> row (staff jobs 1 and 2):
        </p>
        <KbUl>
          <li>
            <strong className="font-medium text-zinc-300">Business (1–20):</strong> Financial competence — sponsorships,
            revenue, stadium expansion. Low Business boards panic over minor debts and force sales.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Interference (1–20):</strong> Likelihood of meddling — accepting
            bids over your head or blocking signings you want.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Patience (1–20):</strong> Job security — high Patience tolerates
            bad runs while you rebuild; low Patience sacks quickly.
          </li>
          <li>
            <strong className="font-medium text-zinc-300">Resources (1–20, &quot;sugar daddy&quot;):</strong> How often the
            board member injects personal wealth — clearing debt and boosting the transfer kitty.
          </li>
        </KbUl>
        <p className="text-zinc-500">
          Use the Staff / MD editor to browse all staff, filter Chairman + Managing Director roles, and set minimums on
          these hidden bytes.
        </p>
      </KbSection>
    </div>
  )
}
