import {escapeHtml as esc, setBusy} from './ui.js?v=ai-opponent-1';

export function studioNavigation(current, platformOwner) {
 const tab = (id, label) => `<button type="button" id="studio-${id}" class="secondary"${current === id ? ' aria-current="page"' : ''}>${label}</button>`;
 return `<nav class="studio-nav" aria-label="Administration">${tab('admin', 'Admin')}${tab('ai', 'AI settings')}${tab('teams', 'Users & Teams')}${platformOwner ? tab('administrators', 'Administrators') : ''}</nav>`;
}

export function aiPhaseFields(opponent) {
 return `<fieldset class="ai-phase-fields"><legend>AI opponent</legend>
  <p class="hint">Choose when each team or individual shares a fixed pool of customers with its own independently generated AI rival.</p>
  <label><input type="checkbox" name="aiPractice"${opponent?.practice ? ' checked' : ''}>Practice phase</label>
  <label><input type="checkbox" name="aiMain"${opponent?.main ? ' checked' : ''}>Main phase · all three scored seasons</label>
 </fieldset>`;
}

function configuredModel(settings) {
 const lab = settings?.providers.find(item => item.hasKey && item.id === settings.provider);
 const model = lab?.models.find(item => item.id === settings.model);
 return model && {provider:lab.id, model:model.id, label:lab.label + ' · ' + model.label};
}

export function phaseModelHint(settings) {
 const chosen = configuredModel(settings);
 return chosen ? 'Selected model: ' + chosen.label : 'To activate an AI opponent, add a provider key and select a model in AI settings.';
}

export function readAiOpponent(form, settings) {
 const practice = form.elements.aiPractice.checked, main = form.elements.aiMain.checked;
 if (!practice && !main) return null;
 const option = form.elements.aiModel?.selectedOptions[0];
 const chosen = option ? {provider:option.dataset.provider, model:option.value} : configuredModel(settings);
 if (!chosen?.model) throw Error('Choose a model in AI settings before activating an AI opponent.');
 return {provider:chosen.provider, model:chosen.model, practice, main};
}

function modelOptions(select, providers, selection) {
 const document = select.ownerDocument;
 select.replaceChildren();
 for (const provider of providers.filter(item => item.hasKey && item.models.length)) {
  const group = document.createElement('optgroup');
  group.label = provider.label;
  for (const model of provider.models) {
   const option = document.createElement('option');
   option.value = model.id;
   option.dataset.provider = provider.id;
   option.textContent = model.label;
   group.append(option);
   if (provider.id === selection?.provider && model.id === selection.model) option.selected = true;
  }
  select.append(group);
 }
}

export async function showAiSettingsPanel(panel, api, {demo, confirmRemoval}) {
 panel.innerHTML = '<p role="status">Loading AI settings…</p>';
 let settings;
 try {
  settings = await api.getAiSettings();
 } catch {
  if (!panel.isConnected) return;
  panel.innerHTML = '<p role="alert">AI settings could not load. Check your connection and try again.</p><button type="button" class="secondary">Retry</button>';
  panel.querySelector('button').onclick = () => showAiSettingsPanel(panel, api, {demo, confirmRemoval});
  return;
 }
 if (!panel.isConnected) return;
 const render = (keyProvider = settings.provider, message = '') => {
  const lab = settings.providers.find(item => item.id === keyProvider) || settings.providers[0];
  panel.innerHTML = `<div class="ai-settings-layout">
   <section class="panel"><h2>API keys</h2><p class="hint">${demo ? 'Local demo uses synthetic provider connections. Live classrooms use the API key saved by their administrator.' : 'Add a key for each provider you want to use. Provider requests use your account and its available quota.'}</p>
    <form id="ai-key-form"><label>AI provider<select name="provider">${settings.providers.map(item => `<option value="${esc(item.id)}"${item === lab ? ' selected' : ''}>${esc(item.label)}${item.hasKey ? ' · Connected' : ''}</option>`).join('')}</select></label>
    ${demo ? '' : `<label>${esc(lab.label)} API key<input name="apiKey" type="password" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="4096" required></label>`}
    <div class="button-row"><button>${demo ? (lab.hasKey ? 'Refresh demo connection' : 'Connect demo provider') : (lab.hasKey ? 'Replace key' : 'Save key')}</button>
    ${lab.hasKey ? '<button type="button" id="remove-ai-key" class="secondary">Remove key</button>' : ''}</div></form>
   </section>
   <section class="panel"><h2>Simulation model</h2><p class="hint">Choose the model for new classrooms with an active AI opponent.</p>
    <form id="ai-model-form"><label>Opponent model<select name="aiModel"></select></label><button>Save model</button></form>
    <p id="ai-current-model" class="hint">${esc(phaseModelHint(settings))}</p>
   </section></div><p class="ai-status" id="ai-settings-status" role="status" aria-live="polite">${esc(message)}</p>`;
  const keyForm = panel.querySelector('#ai-key-form'), modelForm = panel.querySelector('#ai-model-form');
  const modelSelect = modelForm.elements.aiModel;
  modelOptions(modelSelect, settings.providers, settings);
  if (!modelSelect.options.length) {
   const option = modelSelect.ownerDocument.createElement('option');
   option.textContent = 'Add a provider key first';
   modelSelect.append(option);
   modelSelect.disabled = true;
   modelForm.querySelector('button').disabled = true;
  }
  const save = async (request, status, success) => {
   const feedback = panel.querySelector('#ai-settings-status');
   const restore = setBusy(panel, true);
   keyForm.elements.provider.disabled = true;
   modelSelect.disabled = true;
   feedback.textContent = status;
   try {
    settings = await api.saveAiSettings(request);
    if (panel.isConnected) render(lab.id, success);
   } catch (error) {
    if (panel.isConnected) feedback.textContent = error.message || 'Could not save AI settings. Try again.';
   } finally {
    restore();
    keyForm.elements.provider.disabled = false;
    modelSelect.disabled = modelSelect.options.length === 1 && !modelSelect.options[0].dataset.provider;
   }
  };
  keyForm.elements.provider.onchange = () => render(keyForm.elements.provider.value);
  keyForm.onsubmit = event => {
   event.preventDefault();
   if (panel.hasAttribute('aria-busy')) return;
   const apiKey = demo ? 'demo-fixture' : keyForm.elements.apiKey.value.trim();
   if (!apiKey) { panel.querySelector('#ai-settings-status').textContent = 'Enter an API key.'; return; }
   void save({provider:lab.id, apiKey}, 'Checking provider access and available models…', lab.label + ' connected.');
  };
  const remove = panel.querySelector('#remove-ai-key');
  if (remove) remove.onclick = async () => {
   if (await confirmRemoval(`Remove your ${lab.label} key? Preparing new opponents with this provider will require a connected key.`) && panel.isConnected)
    await save({provider:lab.id, removeKey:true}, 'Removing key…', lab.label + ' key removed.');
  };
  modelForm.onsubmit = event => {
   event.preventDefault();
   if (panel.hasAttribute('aria-busy') || modelSelect.disabled) return;
   const option = modelSelect.selectedOptions[0];
   void save({provider:option.dataset.provider, model:option.value}, 'Saving model…', 'Simulation model saved.');
  };
 };
 render();
}

export async function editSessionAi(form, session, api) {
 const feedback = form.querySelector('[role="status"]'), select = form.elements.aiModel;
 const save = form.querySelector('button');
 feedback.textContent = 'Loading available models…';
 let settings;
 try {
  settings = await api.getAiSettings();
 } catch {
  if (form.isConnected) feedback.textContent = 'Available models could not load. Reopen the editor to try again.';
  return;
 }
 if (!form.isConnected) return;
 modelOptions(select, settings.providers, session.aiOpponent || settings);
 select.disabled = select.options.length === 0;
 save.disabled = false;
 feedback.textContent = select.options.length ? '' : phaseModelHint(settings);
 form.onsubmit = async event => {
  event.preventDefault();
  if (save.disabled) return;
  save.disabled = true;
  try {
   const opponent = readAiOpponent(form, settings);
   feedback.textContent = 'Saving phase settings…';
   await api.saveSessionAiOpponent(session.code, opponent);
   if (form.isConnected) feedback.textContent = 'Phase settings saved.';
  } catch (error) {
   feedback.textContent = error.message || 'Phase settings could not be saved.';
  } finally {
   save.disabled = false;
  }
 };
}
