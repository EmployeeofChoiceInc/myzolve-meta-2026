import { useMemo, useState } from 'react';
import './life.css';
import { getGetLifeDemoFixturesQueryKey, useGetLifeDemoFixtures, useGenerateLifePlan, useReplanLifePlan } from '@workspace/api-client-react';
import type { LifePlan, LifeTaskSuggestion } from '@workspace/api-client-react';
import { AlertCircle, ArrowRight, Check, ChevronDown, CircleHelp, Clock3, Heart, LoaderCircle, LockKeyhole, RefreshCw, ShieldCheck, Sparkles, UsersRound } from 'lucide-react';

type ReplanResult = { preservedTasks: string[]; refreshedTasks: string[] };

const initialScenario = 'A severe winter storm is expected to bring heavy snow and possible power outages to our area for the next two days.';

function LifeHome() {
  const fixturesQuery = useGetLifeDemoFixtures({ query: { queryKey: getGetLifeDemoFixturesQueryKey() } });
  const generatePlan = useGenerateLifePlan();
  const replan = useReplanLifePlan();
  const fixtures = fixturesQuery.data;
  const [householdId, setHouseholdId] = useState('');
  const [scenario, setScenario] = useState('');
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [plan, setPlan] = useState<LifePlan | null>(null);
  const [changedCircumstances, setChangedCircumstances] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [replanSummary, setReplanSummary] = useState<ReplanResult | null>(null);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  const household = useMemo(() => fixtures?.households.find(item => item.id === householdId) ?? fixtures?.households[0], [fixtures, householdId]);
  const activeHouseholdId = household?.id ?? householdId;
  const memberName = (id: string | null) => household?.members.find(member => member.id === id)?.name ?? 'Not assigned';
  const allSuggested = plan?.tasks.filter(task => task.status === 'suggested') ?? [];

  const updateTask = (id: string, patch: Partial<LifeTaskSuggestion>) => {
    setPlan(current => current ? { ...current, tasks: current.tasks.map(task => task.id === id ? { ...task, ...patch } : task) } : current);
  };
  const handleGenerate = () => {
    setErrorMessage('');
    setPlan(null);
    setReplanSummary(null);
    generatePlan.mutate({ data: { householdId: activeHouseholdId, scenarioDescription: scenario.trim() } }, {
      onSuccess: result => { setPlan(result); setSelectedTasks([]); },
      onError: error => setErrorMessage(error instanceof Error ? error.message : 'The plan could not be generated. Please try again.')
    });
  };
  const handleReplan = () => {
    if (!plan || !changedCircumstances.trim() || selectedTasks.length === 0) return;
    setErrorMessage('');
    replan.mutate({ data: { householdId: plan.householdId, scenarioDescription: plan.scenarioDescription, changedCircumstances: changedCircumstances.trim(), plan, affectedTaskIds: selectedTasks } }, {
      onSuccess: result => {
        setPlan(current => {
          if (!current) return result.plan;
          const refreshedIds = new Set(result.refreshedTaskIds);
          const preserved = current.tasks.filter(task => task.status !== 'suggested' || !selectedTasks.includes(task.id));
          const refreshed = result.plan.tasks.filter(task => refreshedIds.has(task.id));
          return { ...result.plan, tasks: [...preserved, ...refreshed] };
        });
        const preservedTasks = result.preservedTaskIds.map(id => plan.tasks.find(task => task.id === id)?.title ?? id);
        const refreshedTasks = result.plan.tasks.filter(task => result.refreshedTaskIds.includes(task.id)).map(task => task.title);
        setReplanSummary({ preservedTasks, refreshedTasks });
        setSelectedTasks([]);
        setChangedCircumstances('');
      },
      onError: error => setErrorMessage(error instanceof Error ? error.message : 'The plan could not be refreshed. Please try again.')
    });
  };

  if (fixturesQuery.isLoading) return <main className="loading-page"><div className="loading-mark"><Heart size={22} /></div><div className="skeleton-line wide" /><div className="skeleton-line" /><div className="skeleton-card" /><p>Getting the demo household ready…</p></main>;
  if (fixturesQuery.isError) return <main className="center-state"><div className="state-icon warning"><AlertCircle /></div><p className="eyebrow">A small pause</p><h1>We couldn’t load the demo data.</h1><p>Check your connection and try again. No family information has been saved.</p><button className="button primary" onClick={() => fixturesQuery.refetch()} data-testid="button-retry-fixtures"><RefreshCw size={16} /> Try again</button></main>;
  if (!fixtures || fixtures.households.length === 0 || fixtures.scenarios.length === 0) return <main className="center-state"><div className="state-icon"><CircleHelp /></div><p className="eyebrow">Demo unavailable</p><h1>There isn’t a sample household to show yet.</h1><p>Fixtures are currently unavailable. Please come back when the demo data is ready.</p></main>;

  const modelErrorText = `${errorMessage} ${generatePlan.error instanceof Error ? generatePlan.error.message : ''}`.toLowerCase();
  const noModelKey = modelErrorText.includes('api key') || modelErrorText.includes('model unavailable') || modelErrorText.includes('temporarily unavailable') || modelErrorText.includes('503');

  return <main className="life-shell">
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Heart size={18} strokeWidth={2.2} /></div><span>MyZolve <b>LIFE</b></span></div>
      <div className="demo-chip"><span className="demo-dot" /> Synthetic demo</div>
      <div className="top-note"><LockKeyhole size={14} /> Nothing is saved in this session</div>
    </header>
    <div className="notice-bar" role="note" data-testid="notice-synthetic-data"><ShieldCheck size={17} /><span><b>Demo data only.</b> Please don’t enter real personal or medical details.</span><span className="notice-right">Fictional household · model-generated suggestions</span></div>

    <section className="intro">
      <div className="intro-copy">
        <p className="eyebrow"><span className="eyebrow-line" /> A little more ready, together</p>
        <h1>When plans change,<br /><em>find your next step.</em></h1>
        <p className="intro-text">Explore a sample resilience plan for a fictional household. Review each suggestion together, make it your own, and decide what feels right.</p>
        <div className="intro-meta"><span><UsersRound size={15} /> Your household, at a glance</span><span><ShieldCheck size={15} /> You stay in control</span></div>
      </div>
      <div className="orbit-art" aria-hidden="true"><div className="sun-disc" /><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit orbit-three" /><span className="orbit-label label-a">together</span><span className="orbit-label label-b">one step</span><span className="orbit-label label-c">at a time</span><div className="orbit-center"><Heart size={27} /></div></div>
    </section>

    <section className="workspace" aria-label="Resilience plan demo">
      <aside className="setup-panel">
        <div className="section-kicker"><span>01</span> Start with a situation</div>
        <h2>What might your household be facing?</h2>
        <p className="panel-copy">Choose a sample scenario or describe one in your own words.</p>
        <label className="field-label" htmlFor="household-select">Sample household</label>
        <div className="select-wrap"><select id="household-select" value={activeHouseholdId} disabled={generatePlan.isPending || replan.isPending} onChange={event => { setHouseholdId(event.target.value); setPlan(null); setSelectedTasks([]); setReplanSummary(null); }} data-testid="select-household">{fixtures.households.map(home => <option key={home.id} value={home.id}>{home.name}</option>)}</select><ChevronDown size={16} /></div>
        {household && <div className="household-card" data-testid={`card-household-${household.id}`}><div className="household-heading"><div className="household-avatar"><UsersRound size={18} /></div><div><b>{household.name}</b><span>{household.description}</span></div></div><div className="member-list">{household.members.map((member, index) => <div className="member-row" key={member.id} data-testid={`member-${member.id}`}><span className={`member-initial member-${index % 4}`}>{member.name.charAt(0)}</span><div className="member-details"><b>{member.name}</b><span>{member.relationship} · {member.availability}</span></div><span className="member-strength">{member.strengths[0]}</span></div>)}</div></div>}
        <label className="field-label scenario-label" htmlFor="scenario-select">A situation to explore</label>
        <select id="scenario-select" className="scenario-select" value={selectedScenarioId} disabled={generatePlan.isPending || replan.isPending} onChange={event => { const option = fixtures.scenarios.find(item => item.id === event.target.value); setSelectedScenarioId(event.target.value); if (option) setScenario(option.description); }} data-testid="select-scenario"><option value="">Choose a sample scenario…</option>{fixtures.scenarios.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>
        <textarea className="scenario-input" aria-label="Describe the situation" placeholder={initialScenario} value={scenario} disabled={generatePlan.isPending || replan.isPending} onChange={event => { setScenario(event.target.value); setSelectedScenarioId(''); }} maxLength={2000} data-testid="input-scenario" />
        <div className="field-foot"><span>Keep it general; no personal details.</span><span>{scenario.length}/2,000</span></div>
        <button className="button primary generate-button" onClick={handleGenerate} disabled={generatePlan.isPending || scenario.trim().length < 10} data-testid="button-generate-plan">{generatePlan.isPending ? <><LoaderCircle className="spin" size={16} /> Building a sample plan…</> : <>Create a sample plan <ArrowRight size={16} /></>}</button>
        {errorMessage && <div className={`inline-error ${noModelKey ? 'model-error' : ''}`} role="alert" data-testid="status-plan-error"><AlertCircle size={17} /><div><b>{noModelKey ? 'The model isn’t available right now.' : 'We couldn’t create that plan.'}</b><span>{noModelKey ? 'This demo needs a configured model key. No sample response has been substituted.' : errorMessage}</span></div></div>}
      </aside>

      <section className="plan-panel" aria-live="polite">
        {!plan ? <div className="plan-empty"><div className="empty-illustration"><div className="empty-sun" /><div className="empty-sheet"><span /><span /><span /></div><div className="empty-leaf" /></div><p className="eyebrow">Your plan will live here</p><h2>Thoughtful steps.<br />Made for your situation.</h2><p>Choose a scenario and create a plan to see model-generated suggestions for this fictional household.</p><div className="empty-rule" /><span className="empty-foot"><LockKeyhole size={14} /> Suggestions stay in this browser session only</span></div> : <div className="plan-content">
          <div className="plan-heading"><div><div className="section-kicker"><span>02</span> Review together <span className="version-tag">Version {plan.version}</span></div><h2 data-testid="text-plan-title">{plan.title}</h2></div><div className="plan-stamp"><Sparkles size={15} /> Model-generated</div></div>
          <p className="plan-summary" data-testid="text-plan-summary">{plan.summary}</p>
          <div className="plan-statline"><span><b>{plan.tasks.length}</b> suggested steps</span><span className="stat-divider" /><span><b>{plan.tasks.filter(task => task.status === 'approved').length}</b> approved by you</span><span className="stat-divider" /><span><b>{plan.tasks.filter(task => task.status === 'completed').length}</b> completed</span></div>
          {plan.assumptions.length > 0 && <details className="assumptions"><summary data-testid="summary-plan-assumptions"><CircleHelp size={15} /> What this plan assumes <ChevronDown size={14} /></summary><ul>{plan.assumptions.map((item, index) => <li key={index}>{item}</li>)}</ul></details>}
          {plan.clarificationQuestions.length > 0 && <div className="questions-block"><p className="mini-label">Worth talking through</p>{plan.clarificationQuestions.map((question, index) => <div className="question-row" key={index}><span>?</span>{question}</div>)}</div>}
          <div className="task-header"><div><p className="mini-label">Suggested steps</p><span>Nothing happens until your household says yes.</span></div><div className="legend"><span className="legend-dot suggested-dot" /> Suggested <span className="legend-dot approved-dot" /> Approved</div></div>
          <div className="tasks-list">{plan.tasks.map((task, index) => <article className={`task-card task-${task.status}`} key={task.id} data-testid={`card-task-${task.id}`}>
            <div className="task-main"><span className="task-number">{String(index + 1).padStart(2, '0')}</span><div className="task-body">
              {editingTask === task.id ? <div className="edit-fields"><input value={task.title} onChange={event => updateTask(task.id, { title: event.target.value })} aria-label="Edit task title" data-testid={`input-task-title-${task.id}`} /><textarea value={task.description} onChange={event => updateTask(task.id, { description: event.target.value })} aria-label="Edit task description" data-testid={`input-task-description-${task.id}`} /><input value={task.timing} onChange={event => updateTask(task.id, { timing: event.target.value })} aria-label="Edit task timing" data-testid={`input-task-timing-${task.id}`} /><select value={task.assignedMemberId ?? ''} onChange={event => updateTask(task.id, { assignedMemberId: event.target.value || null })} aria-label="Assign task to household member" data-testid={`select-task-assignee-${task.id}`}><option value="">Not assigned</option>{household?.members.map(member => <option key={member.id} value={member.id}>{member.name}</option>)}</select><div className="edit-actions"><button className="text-button" onClick={() => setEditingTask(null)} data-testid={`button-save-task-${task.id}`}><Check size={14} /> Done editing</button></div></div> :
                <><button className="task-title-button" onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)} data-testid={`button-expand-task-${task.id}`}>{task.title}<ChevronDown size={15} className={expandedTask === task.id ? 'rotate' : ''} /></button><p className="task-description">{task.description}</p></>}
              <div className="task-tags"><span className={`priority priority-${task.priority}`}>{task.priority}</span><span><Clock3 size={13} /> {task.timing}</span><span className="assigned-to">{memberName(task.assignedMemberId)}</span>{task.reviewRequired && <span className="review-pill">Review first</span>}</div>
              {expandedTask === task.id && editingTask !== task.id && <div className="task-rationale"><b>Why it’s suggested</b><p>{task.rationale}</p><button className="text-button" onClick={() => setEditingTask(task.id)} data-testid={`button-edit-task-${task.id}`}>Edit suggestion</button></div>}
              {task.status === 'approved' && <span className="task-state"><Check size={13} /> Approved by you</span>}
              {task.status === 'completed' && <span className="task-state complete"><Check size={13} /> Marked complete</span>}
            </div></div><div className="task-actions">
              {task.status === 'suggested' && <><button className="approve-button" onClick={() => updateTask(task.id, { status: 'approved' })} data-testid={`button-approve-task-${task.id}`}><Check size={14} /> Approve</button><button className="edit-icon" aria-label={`Edit ${task.title}`} onClick={() => { setExpandedTask(task.id); setEditingTask(task.id); }} data-testid={`button-edit-task-action-${task.id}`}>Edit</button></>}
              {task.status === 'approved' && <button className="complete-button" onClick={() => updateTask(task.id, { status: 'completed' })} data-testid={`button-complete-task-${task.id}`}>Mark complete</button>}
            </div>
          </article>)}</div>
          {replanSummary && <div className="replan-result" data-testid="status-replan-result"><div><Check size={16} /><b>Plan refreshed thoughtfully</b></div><p>Kept as-is: {replanSummary.preservedTasks.length ? replanSummary.preservedTasks.join('; ') : 'none'}<br />Revised suggestions: {replanSummary.refreshedTasks.length ? replanSummary.refreshedTasks.join('; ') : 'none returned'}</p></div>}
          <details className="replan-box"><summary data-testid="summary-replan"><RefreshCw size={15} /> Circumstances changed? <ChevronDown size={14} /></summary><div className="replan-inner"><p>Choose only the suggested steps you want the model to revisit. Approved and completed steps are kept as they are.</p><div className="replan-selection">{allSuggested.length === 0 ? <span className="all-reviewed">All suggestions have been reviewed.</span> : allSuggested.map(task => <label key={task.id} className="check-row"><input type="checkbox" checked={selectedTasks.includes(task.id)} onChange={event => setSelectedTasks(current => event.target.checked ? [...current, task.id] : current.filter(id => id !== task.id))} data-testid={`checkbox-replan-${task.id}`} /><span>{task.title}</span></label>)}</div><label className="field-label" htmlFor="changed-circumstances">What has changed?</label><textarea id="changed-circumstances" className="scenario-input replan-textarea" value={changedCircumstances} onChange={event => setChangedCircumstances(event.target.value)} placeholder="For example, someone is now home and can help with preparations." maxLength={2000} data-testid="input-changed-circumstances" /><button className="button secondary replan-button" onClick={handleReplan} disabled={replan.isPending || changedCircumstances.trim().length < 10 || selectedTasks.length === 0} data-testid="button-replan">{replan.isPending ? <><LoaderCircle className="spin" size={15} /> Refreshing suggestions…</> : <>Refresh selected suggestions <ArrowRight size={15} /></>}</button>{replan.error && <p className="replan-error" role="alert" data-testid="status-replan-error">{replan.error instanceof Error ? replan.error.message : 'Unable to refresh selected suggestions.'}</p>}</div></details>
          <p className="plan-disclaimer"><ShieldCheck size={15} /> A planning aid, not emergency, medical, or professional advice. Use your judgment and trusted local guidance.</p>
        </div>}
      </section>
    </section>
    <footer className="footer"><div className="footer-brand"><div className="brand-mark small"><Heart size={14} /></div><span>MyZolve <b>LIFE</b></span></div><span>Preparedness is personal. This is only a synthetic demonstration.</span><span className="footer-session"><LockKeyhole size={13} /> Session-only edits</span></footer>
  </main>;
}

export default LifeHome;
