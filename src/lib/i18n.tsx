import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Locale } from '../types';

const en = {
  'meta.title': 'PolySend · emails in real time',
  'meta.description':
    'PolySend — emails written in real time with OpenCode Go models.',

  'header.status.loading': 'Connecting',
  'header.status.ready': 'Go connected',
  'header.status.error': 'Connection error',
  'header.status.nokey': 'API not configured',
  'header.source.server': '.env on server',
  'header.source.client': 'panel key',
  'header.source.none': 'set up',
  'header.planCaption': 'this month',
  'header.planTitle': 'Monthly Go plan usage',
  'header.models': 'Models',
  'header.configure': 'Configure API',
  'header.docsTitle': 'OpenCode Go documentation',
  'header.docsAria': 'Open OpenCode Go documentation',
  'header.statusAria': 'API status: {status}. Configure key.',
  'header.switchLanguage': 'Switch to Portuguese',

  'briefing.eyebrow': '01 · briefing',
  'briefing.title': 'What are we writing?',
  'briefing.tagLive': 'live',
  'briefing.tagDraft': 'draft',
  'briefing.examplesAria': 'Email examples',
  'briefing.recipient': 'Recipient',
  'briefing.recipientHint': 'name and email',
  'briefing.recipientPlaceholder': 'Mariana Costa · mariana@company.com',
  'briefing.company': 'Company',
  'briefing.companyHint': 'context',
  'briefing.companyPlaceholder': 'Northwind Technologies',
  'briefing.goal': 'Goal',
  'briefing.goalPlaceholder':
    'e.g. request a quote for a logistics app, launching in eight weeks.',
  'briefing.tone': 'Tone',
  'briefing.toneHint': 'how it should sound',
  'briefing.toneAria': 'Email tone',
  'briefing.length': 'Length',
  'briefing.lengthAria': 'Email length',
  'briefing.language': 'Language',
  'briefing.context': 'Context & signature',
  'briefing.filled': 'filled',
  'briefing.details': 'Details',
  'briefing.optional': 'optional',
  'briefing.detailsPlaceholder':
    'Deadlines, budget, constraints, next steps…',
  'briefing.signature': 'Signature',
  'briefing.signatureHint': 'appears at the end',
  'briefing.signaturePlaceholder': 'Alex Morgan\nHead of Product · Acme',
  'briefing.generate': 'Generate email',
  'briefing.stop': 'Stop generating',
  'briefing.shortcutTitle': 'Shortcut: Ctrl + Enter',
  'briefing.writingWith': 'writing with {model} · token by token',
  'briefing.chooseModelHint': 'choose a model from the catalog',
  'briefing.presetLoaded': 'Preset “{label}” loaded.',

  'tone.profissional': 'Professional',
  'tone.direto': 'Direct',
  'tone.amigavel': 'Friendly',
  'tone.persuasivo': 'Persuasive',
  'tone.empatico': 'Empathetic',
  'tone.formal': 'Formal',

  'length.curto': 'Short',
  'length.medio': 'Medium',
  'length.longo': 'Long',
  'length.curtoHint': 'up to 90 words',
  'length.medioHint': '120–170 words',
  'length.longoHint': '200–260 words',

  'language.ptBR': 'Portuguese (BR)',
  'language.en': 'English',
  'language.es': 'Spanish',

  'email.status.interrupted': 'interrupted',
  'email.status.connecting': 'connecting',
  'email.status.thinking': 'thinking',
  'email.status.writing': 'writing live',
  'email.status.ready': 'draft ready',
  'email.status.empty': 'empty draft',
  'email.copyTitle': 'Copy full email',
  'email.copyAria': 'Copy full email',
  'email.downloadTitle': 'Download as .txt',
  'email.downloadAria': 'Download email as a text file',
  'email.newTitle': 'New draft',
  'email.newAria': 'Clear and start a new draft',
  'email.to': 'To',
  'email.subject': 'Subject',
  'email.now': 'now',
  'email.toPlaceholder': 'recipient@company.com',
  'email.subjectStreaming': 'Subject arrives in the first tokens…',
  'email.subjectPlaceholder': 'Email subject',
  'email.emptyTitle': 'Your email starts here',
  'email.emptyBefore': 'Fill in the brief and click ',
  'email.emptyAfter': '. The response is written in real time, token by token.',
  'email.emptyMetaStreaming': 'streaming SSE',
  'email.emptyMetaEngine': 'opencode go',
  'email.emptyMetaEditable': 'editable',
  'email.thinkingConnecting': 'Connecting to the model…',
  'email.thinkingModel': 'The model is thinking…',
  'email.thinkingPreparing': 'Getting the first words ready…',
  'email.errorTitle': "Couldn't generate",
  'email.errorFallback': 'Generation was interrupted.',
  'email.retry': 'Try again',
  'email.bodyAria': 'Email body',
  'email.selectionCount': '{count} characters selected',
  'email.selectionPlaceholder':
    'e.g. more direct, focus on the deadline, no jargon…',
  'email.selectionAria': 'Instruction to rewrite the selection',
  'email.rewrite': 'Rewrite',
  'email.cancelSelection': 'Cancel selection',
  'email.selectionDefaultInstruction':
    'Make this passage clearer and more natural while keeping the tone and meaning.',
  'email.refineTitle': 'Adjust with AI',
  'email.viewFormatted': 'View formatted',
  'email.editText': 'Edit text',
  'email.refineHintView':
    'Click “Edit text” to adjust manually or select a passage.',
  'email.refineHintEdit':
    'Select a passage to rewrite only that part — no need to redo the whole email.',
  'email.modelChipFallback': 'Choose model',
  'email.noModel': 'no model',
  'email.waitingFirst': 'waiting for the first generation',
  'email.receivingTokens': 'receiving tokens…',
  'email.draftFilename': 'draft',
  'email.streamingTitle': 'Streaming: {label}',
  'email.ttft': 'TTFT',
  'email.tokens': 'tok',

  'refine.shorter': 'Shorter',
  'refine.formal': 'More formal',
  'refine.persuasive': 'More persuasive',
  'refine.warmer': 'Warmer',
  'refine.cta': 'Clearer CTA',
  'refine.translateToEnglish': 'Translate to English',
  'refine.translateToPortuguese': 'Translate to Portuguese',
  'refine.shorterInstruction':
    'Make the body shorter and more direct while preserving the main request, facts, and signature.',
  'refine.formalInstruction':
    'Make the tone more formal and polished without sounding stiff or bureaucratic.',
  'refine.persuasiveInstruction':
    'Make the text more persuasive by highlighting the value to the recipient without exaggeration.',
  'refine.warmerInstruction':
    'Make the tone warmer and more empathetic while keeping it clear and professional.',
  'refine.ctaInstruction':
    'Make the next step (call to action) clearer, more specific, and easier to reply to.',
  'refine.translateToEnglishInstruction':
    'Translate the body of the email into natural, professional English while preserving names, numbers, formatting, and the signature.',
  'refine.translateToPortugueseInstruction':
    'Translate the body of the email into natural, professional Brazilian Portuguese while preserving names, numbers, formatting, and the signature.',

  'models.eyebrow': '03 · live catalog',
  'models.title': 'Go models',
  'models.refresh': 'Refresh catalog',
  'models.refreshAria': 'Refresh model catalog',
  'models.planAria': 'Go plan',
  'models.planLimit': 'Monthly limit per model',
  'models.planNote':
    'Base prices per 1M tokens. The monthly limit applies if you use only this model — usage is shared.',
  'models.searchPlaceholder': 'Search models…',
  'models.searchAria': 'Search models',
  'models.clearSearch': 'Clear search',
  'models.filtersAria': 'Filter models',
  'models.filter.all': 'All',
  'models.filter.featured': 'Featured',
  'models.filter.free': 'Free',
  'models.filter.zdr': 'ZDR',
  'models.featuredAria': 'Featured model',
  'models.badgeFree': 'free',
  'models.badgeZdr': 'zdr',
  'models.limitFree': "doesn't use the plan",
  'models.limitPerMonth': '{price}/mo on {plan}',
  'models.limitUnknown': 'limit not provided',
  'models.listAria': 'OpenCode Go models',
  'models.connectTitle': 'Connect the API',
  'models.connectBody':
    'Paste your OpenCode Go key to load live models and pricing.',
  'models.connectButton': 'Configure API',
  'models.retry': 'Try again',
  'models.changeKey': 'Change key',
  'models.noResults': 'No models found with this filter.',
  'models.clearFilters': 'Clear filters',
  'models.count': '{filtered} of {total}',
  'models.viaEnv': 'via .env',
  'models.viaPanel': 'via panel',
  'models.apiLabel': 'go/v1/models',
  'models.limitTitle':
    '{price} monthly limit for {model} on {plan}',

  'usage.title': 'plan usage',
  'usage.refreshTitle': 'Refresh plan usage',
  'usage.refreshAria': 'Refresh plan usage',
  'usage.console': 'Console',
  'usage.consoleTitle': 'Open the OpenCode Console',
  'usage.syncing': 'syncing',
  'usage.noKey':
    'Connect your key to track the real Go windows.',
  'usage.connect': 'Connect API',
  'usage.window5h': '5 hours',
  'usage.week': 'Week',
  'usage.month': 'Month',
  'usage.footRequests': '{count} req.',
  'usage.footTokens': '{input} in · {output} out',
  'usage.footTable': 'table {cost}',
  'usage.footPlan': 'plan {cost}',
  'usage.footSession': 'session {percent} of limit',
  'usage.unavailable': 'Plan usage is unavailable for this key.',
  'usage.fetching': 'Fetching plan usage…',
  'usage.update': 'Refresh',
  'usage.ttftTitle': 'Time to first token',
  'usage.tpsTitle': 'Tokens per second',

  'key.eyebrow': 'access · opencode go',
  'key.title': 'Connect your API',
  'key.intro':
    'Paste the API key from your OpenCode Console workspace. Validation happens live against the Go catalog.',
  'key.label': 'API key',
  'key.already': 'a key is already saved in this tab',
  'key.placeholder': 'oc_sk_...',
  'key.show': 'Show key',
  'key.hide': 'Hide key',
  'key.submit': 'Validate and connect',
  'key.validating': 'Validating key…',
  'key.or': 'or',
  'key.useServer': 'Use server key (.env)',
  'key.remove': 'Remove the panel key from this tab',
  'key.helpTitle': 'How to get your key',
  'key.help1Before': 'Open the ',
  'key.help1After': ' and sign in to the workspace with Go enabled.',
  'key.help2Before': 'Go to ',
  'key.help2After': ' and create a key.',
  'key.help3':
    'Copy the key (it is shown only once) and paste it here.',
  'key.security':
    'The panel key stays only in this tab’s sessionStorage and goes straight to your local backend. The server does not write it to disk. For production, keep the key on the server only.',
  'key.successTitle': 'Connected',
  'key.successModels':
    '{count} models available. Key validated successfully.',
  'key.successServer': 'Using the server key (.env).',
  'key.validationFailed': 'Could not validate the key.',
  'key.serverFailed': 'The server key did not respond.',
  'key.close': 'Close',
  'key.consoleLink': 'OpenCode Console',
  'key.accountLink': 'Account › Personal API keys',

  'tabs.briefing': 'Briefing',
  'tabs.email': 'Email',
  'tabs.models': 'Models',
  'tabs.navAria': 'Studio navigation',

  'toast.connectToGenerate':
    'Connect your OpenCode Go key to generate.',
  'toast.chooseModel': 'Choose a model from the Go catalog.',
  'toast.describeGoal':
    'Describe the email goal before generating.',
  'toast.stopped': 'Generation stopped.',
  'toast.copied': 'Email copied to the clipboard.',
  'toast.copyFailed': 'Could not copy. Select the text manually.',
  'toast.downloadStarted': 'Download started.',
  'toast.newDraft': 'New draft.',
  'toast.panelKeyRemovedServer':
    'Panel key removed. Using the server key.',
  'toast.panelKeyRemoved': 'Panel key removed.',
  'toast.truncated':
    'The response hit the token limit and may be incomplete. Try again.',
  'toast.generic': 'Something went wrong. Try again.',

  'errors.generic': 'Something went wrong. Try again.',
  'errors.network':
    'Could not reach the server. Check that the backend is running (npm run dev or npm start).',
  'errors.invalid_key':
    'Invalid or expired API key. Check it in the OpenCode Console.',
  'errors.forbidden':
    'This key does not have access to Go models. Check the subscription and key permissions.',
  'errors.no_credit':
    'No balance or limit available for this model right now.',
  'errors.not_found':
    'Model not found in the Go catalog. Refresh the model list.',
  'errors.rate_limited':
    'Usage limit reached. Wait for the window to reset or choose another model.',
  'errors.upstream_error':
    'The OpenCode API did not respond as expected. Try again in a moment.',
  'errors.network_error':
    'Could not reach the OpenCode API. Check your connection.',
  'errors.missing_key':
    'No API key configured. Open “Configure API” and paste your OpenCode Go key.',
  'errors.bad_request': 'Invalid request.',
  'errors.invalid_model': 'Choose a valid model from the Go catalog.',
  'errors.missing_topic':
    'Describe the email goal before generating.',
  'errors.missing_body': 'There is no email to refine.',
  'errors.missing_selection':
    'Select a passage of the email to rewrite.',
  'errors.timeout': 'The API took too long to respond. Try again.',
  'errors.empty_stream': 'The API did not return a stream.',
  'errors.empty_response':
    'The model finished without writing the email. Try another model or generate again.',
  'errors.stream_error':
    'The API connection was interrupted. Try generating again.',
  'errors.bad_json': 'The request body is not valid JSON.',
  'errors.internal_error': 'Internal server error. Try again.',
  'errors.no_model':
    'No model selected. Choose one from the Go catalog.',

  'header.delivery': 'Delivery',
  'header.deliveryTitle': 'Resend delivery settings',
  'header.deliveryAria': 'Open delivery settings',
  'email.send': 'Send',
  'email.sendTitle': 'Send this email with Resend',
  'email.sendAria': 'Send this email',
  'email.sent': 'Sent',

  'delivery.eyebrow': 'delivery · resend',
  'delivery.title': 'Send with Resend',
  'delivery.tabs.send': 'Send',
  'delivery.tabs.settings': 'Settings',
  'delivery.provider': 'Provider',
  'delivery.providerResend': 'Resend',
  'delivery.providerNote':
    'The provider layer is ready for SMTP, Amazon SES, and other adapters later.',
  'delivery.connected': 'Connected',
  'delivery.notConnected': 'Not connected',
  'delivery.fullAccess': 'Full access',
  'delivery.restricted': 'Send-only key',
  'delivery.serverKey': 'Server .env key',
  'delivery.panelKey': 'Panel key in this tab',
  'delivery.loading': 'Loading…',
  'delivery.retry': 'Try again',
  'delivery.errorTitle': 'Something went wrong',
  'delivery.providerDetails': 'Provider response',
  'delivery.copyId': 'Copy ID',
  'delivery.copied': 'Copied',
  'delivery.keyTitle': 'Resend API key',
  'delivery.keyHelp':
    'A Full access key can list domains and delivery statuses. A sending-only key can still send emails. Connecting validates the key and saves it to the server’s .env.',
  'delivery.keyPlaceholder': 're_...',
  'delivery.keyValidate': 'Validate and connect',
  'delivery.keyValidating': 'Validating…',
  'delivery.keyUseServer': 'Use server key (.env)',
  'delivery.keyRemove': 'Remove panel key',
  'delivery.keySaved': 'Key validated and saved to the server .env.',
  'delivery.keySaveFailed':
    'The key works for this tab, but it could not be saved to the server .env.',
  'delivery.keyInvalid': 'Invalid Resend API key.',
  'delivery.keyRequired': 'Connect a Resend API key to send.',
  'delivery.keySection': 'Connection',
  'delivery.openApiKeys': 'Resend API keys',
  'delivery.connectTitle': 'Connect Resend to send real emails',
  'delivery.connectBody':
    'Paste a Resend API key in Settings. It is validated and saved to the local server’s .env, then used for sends.',
  'delivery.connectButton': 'Open settings',
  'delivery.domainsTitle': 'Sending domains',
  'delivery.domainsRefresh': 'Refresh domains',
  'delivery.domainsEmpty':
    'No domains in this Resend account. Add and verify a domain before sending.',
  'delivery.domainsRestricted':
    'This key is send-only, so domains cannot be listed. Enter the sender manually or use a Full access key.',
  'delivery.domainsHint':
    'Only verified domains can be used in the From address.',
  'delivery.addDomain': 'Add a domain in Resend',
  'delivery.domainVerify': 'Verify',
  'delivery.domainVerifying': 'Verifying…',
  'delivery.domainVerifyStarted':
    'Verification started. Refresh in a few seconds.',
  'delivery.domainAria': 'Resend sending domains',
  'delivery.domainStatus.verified': 'verified',
  'delivery.domainStatus.pending': 'pending',
  'delivery.domainStatus.not_started': 'not started',
  'delivery.domainStatus.failed': 'failed',
  'delivery.domainStatus.temporary_failure': 'checking',
  'delivery.domainStatus.unknown': 'unknown',
  'delivery.senderTitle': 'Sender identity',
  'delivery.fromName': 'From name',
  'delivery.fromEmail': 'From email',
  'delivery.fromHint': 'Use an email on a verified Resend domain.',
  'delivery.replyTo': 'Reply-To',
  'delivery.replyHint': 'Optional, but use a mailbox you actually read.',
  'delivery.autosave': 'Sender changes are saved in this browser.',
  'delivery.reviewTitle': 'Review and send',
  'delivery.to': 'To',
  'delivery.toPlaceholder': 'recipient@company.com',
  'delivery.from': 'From',
  'delivery.subject': 'Subject',
  'delivery.body': 'Body',
  'delivery.changeSender': 'Change sender',
  'delivery.sendButton': 'Send email',
  'delivery.sending': 'Sending…',
  'delivery.sendNote':
    'This sends a real email through Resend. Review the content before sending.',
  'delivery.reviewCheckbox':
    'I reviewed the content and want to send this email.',
  'delivery.noDraftTitle': 'Generate an email first',
  'delivery.noDraftBody':
    'The draft is empty. Generate or write an email, then come back to send it.',
  'delivery.missingFrom': 'Set a valid sender in Settings before sending.',
  'delivery.invalidTo': 'Enter a valid recipient email.',
  'delivery.sendSuccessTitle': 'Email sent',
  'delivery.sendSuccessBody':
    'Resend accepted the message. Check delivery status in recent sends.',
  'delivery.sendSuccessId': 'Resend ID',
  'delivery.done': 'Done',
  'delivery.rateNote':
    'Sends from this session are rate limited to protect your account.',
  'delivery.testTitle': 'Test email',
  'delivery.testBody':
    'Send a small test using the current sender and API key.',
  'delivery.testTo': 'Test recipient',
  'delivery.testButton': 'Send test',
  'delivery.testing': 'Sending test…',
  'delivery.testSuccess': 'Test email sent. Check the inbox.',
  'delivery.testInvalid': 'Enter a valid test recipient.',
  'delivery.testSubject': 'PolySend test email',
  'delivery.testText':
    'This is a test email from PolySend. If you received it, your Resend setup is working.',
  'delivery.testFromRequired': 'Set a valid sender before testing.',
  'delivery.fromNotVerified':
    'The sender domain is not verified in Resend. Add and verify it before sending.',
  'delivery.historyTitle': 'Recent sends',
  'delivery.historyEmpty': 'No emails sent from this session yet.',
  'delivery.historyRefresh': 'Refresh status',
  'delivery.historyFullAccess':
    'A Full access key is required to refresh delivery status.',
  'delivery.historyError': 'Could not load recent sends.',
  'delivery.viewDashboard': 'Open Resend dashboard',
  'delivery.status': 'status',
  'delivery.event.accepted': 'accepted',
  'delivery.event.sent': 'sent',
  'delivery.event.delivered': 'delivered',
  'delivery.event.bounced': 'bounced',
  'delivery.event.complained': 'complained',
  'delivery.event.opened': 'opened',
  'delivery.event.clicked': 'clicked',
  'delivery.event.delivery_delayed': 'delayed',
  'delivery.event.failed': 'failed',
  'delivery.event.scheduled': 'scheduled',
  'delivery.event.unknown': 'unknown',
  'delivery.security':
    'The key is sent only to your local backend and saved to .env (gitignored), so it survives restarts. Protect the server before exposing it publicly.',
  'delivery.providerReady':
    'Provider layer: Resend now; SMTP, Amazon SES, and others can be plugged in later.',
  'delivery.fullAccessHint':
    'Use a Full access key to list domains and refresh delivery status.',
  'delivery.testNote': 'Test sends also count toward the hourly limit.',

  'errors.missing_resend_key':
    'Connect a Resend API key in Delivery settings to send emails.',
  'errors.resend_invalid_key':
    'The Resend API key is invalid, inactive, or restricted. Use a valid key.',
  'errors.resend_forbidden':
    'Resend rejected the sender or domain. Check the verified domain and key permissions.',
  'errors.resend_validation':
    'Resend rejected the email. Check the recipient, sender, subject, and content.',
  'errors.resend_rate_limited':
    'Resend rate limit reached. Wait a moment and try again.',
  'errors.resend_timeout': 'Resend took too long to respond. Try again.',
  'errors.resend_error': 'Resend could not process the request. Try again.',
  'errors.send_rate_limited':
    'Too many emails sent from this session. Wait a few minutes and try again.',
  'errors.invalid_recipient': 'Enter a valid recipient email.',
  'errors.invalid_sender': 'Enter a valid sender email.',
  'errors.invalid_reply_to': 'Enter a valid Reply-To email.',
  'errors.missing_subject': 'Enter a subject before sending.',
  'errors.missing_email_body': 'The email body is empty.',
  'errors.invalid_domain': 'Invalid domain.',
  'errors.email_not_found': 'This email is not in the session history.',
} satisfies Record<string, string>;

export type MessageKey = keyof typeof en;

const pt: Record<MessageKey, string> = {
  'meta.title': 'PolySend · e-mails em tempo real',
  'meta.description':
    'PolySend — e-mails escritos em tempo real com os modelos do OpenCode Go.',

  'header.status.loading': 'Conectando',
  'header.status.ready': 'Go conectado',
  'header.status.error': 'Falha na conexão',
  'header.status.nokey': 'API não configurada',
  'header.source.server': '.env do servidor',
  'header.source.client': 'chave do painel',
  'header.source.none': 'configurar',
  'header.planCaption': 'do mês',
  'header.planTitle': 'Consumo mensal do plano Go',
  'header.models': 'Modelos',
  'header.configure': 'Configurar API',
  'header.docsTitle': 'Documentação do OpenCode Go',
  'header.docsAria': 'Abrir documentação do OpenCode Go',
  'header.statusAria': 'Status da API: {status}. Configurar chave.',
  'header.switchLanguage': 'Mudar para inglês',

  'briefing.eyebrow': '01 · briefing',
  'briefing.title': 'O que vamos escrever?',
  'briefing.tagLive': 'ao vivo',
  'briefing.tagDraft': 'rascunho',
  'briefing.examplesAria': 'Exemplos de e-mail',
  'briefing.recipient': 'Destinatário',
  'briefing.recipientHint': 'nome e e-mail',
  'briefing.recipientPlaceholder': 'Mariana Costa · mariana@empresa.com',
  'briefing.company': 'Empresa',
  'briefing.companyHint': 'contexto',
  'briefing.companyPlaceholder': 'Northwind Tecnologia',
  'briefing.goal': 'Objetivo',
  'briefing.goalPlaceholder':
    'Ex.: pedir um orçamento para um app de logística, com lançamento em oito semanas.',
  'briefing.tone': 'Tom',
  'briefing.toneHint': 'como deve soar',
  'briefing.toneAria': 'Tom do e-mail',
  'briefing.length': 'Extensão',
  'briefing.lengthAria': 'Extensão do e-mail',
  'briefing.language': 'Idioma',
  'briefing.context': 'Contexto e assinatura',
  'briefing.filled': 'preenchido',
  'briefing.details': 'Detalhes',
  'briefing.optional': 'opcional',
  'briefing.detailsPlaceholder':
    'Prazos, valores, restrições, próximos passos…',
  'briefing.signature': 'Assinatura',
  'briefing.signatureHint': 'vai no fim do e-mail',
  'briefing.signaturePlaceholder': 'Ana Souza\nHead de Produto · Acme',
  'briefing.generate': 'Gerar e-mail',
  'briefing.stop': 'Parar geração',
  'briefing.shortcutTitle': 'Atalho: Ctrl + Enter',
  'briefing.writingWith': 'escrevendo com {model} · token a token',
  'briefing.chooseModelHint': 'escolha um modelo no catálogo ao lado',
  'briefing.presetLoaded': 'Exemplo “{label}” carregado.',

  'tone.profissional': 'Profissional',
  'tone.direto': 'Direto',
  'tone.amigavel': 'Amigável',
  'tone.persuasivo': 'Persuasivo',
  'tone.empatico': 'Empático',
  'tone.formal': 'Formal',

  'length.curto': 'Curto',
  'length.medio': 'Médio',
  'length.longo': 'Longo',
  'length.curtoHint': 'até 90 palavras',
  'length.medioHint': '120–170 palavras',
  'length.longoHint': '200–260 palavras',

  'language.ptBR': 'Português (BR)',
  'language.en': 'Inglês',
  'language.es': 'Espanhol',

  'email.status.interrupted': 'interrompido',
  'email.status.connecting': 'conectando',
  'email.status.thinking': 'pensando',
  'email.status.writing': 'escrevendo ao vivo',
  'email.status.ready': 'rascunho pronto',
  'email.status.empty': 'rascunho vazio',
  'email.copyTitle': 'Copiar e-mail completo',
  'email.copyAria': 'Copiar e-mail completo',
  'email.downloadTitle': 'Baixar como .txt',
  'email.downloadAria': 'Baixar e-mail como arquivo de texto',
  'email.newTitle': 'Novo rascunho',
  'email.newAria': 'Limpar e começar um novo rascunho',
  'email.to': 'Para',
  'email.subject': 'Assunto',
  'email.now': 'agora',
  'email.toPlaceholder': 'destinatário@empresa.com',
  'email.subjectStreaming': 'O assunto chega nos primeiros tokens…',
  'email.subjectPlaceholder': 'Assunto do e-mail',
  'email.emptyTitle': 'Seu e-mail nasce aqui',
  'email.emptyBefore': 'Preencha o briefing e clique em ',
  'email.emptyAfter': '. A resposta é escrita em tempo real, token a token.',
  'email.emptyMetaStreaming': 'streaming SSE',
  'email.emptyMetaEngine': 'opencode go',
  'email.emptyMetaEditable': 'editável',
  'email.thinkingConnecting': 'Conectando ao modelo…',
  'email.thinkingModel': 'O modelo está pensando…',
  'email.thinkingPreparing': 'Preparando as primeiras palavras…',
  'email.errorTitle': 'Não deu para gerar',
  'email.errorFallback': 'A geração foi interrompida.',
  'email.retry': 'Tentar novamente',
  'email.bodyAria': 'Corpo do e-mail',
  'email.selectionCount': '{count} caracteres selecionados',
  'email.selectionPlaceholder':
    'Ex.: mais direto, foco no prazo, sem jargão…',
  'email.selectionAria': 'Instrução para reescrever a seleção',
  'email.rewrite': 'Reescrever',
  'email.cancelSelection': 'Cancelar seleção',
  'email.selectionDefaultInstruction':
    'Deixe este trecho mais claro e natural, mantendo o tom e o sentido.',
  'email.refineTitle': 'Ajustar com IA',
  'email.viewFormatted': 'Ver formatado',
  'email.editText': 'Editar texto',
  'email.refineHintView':
    'Clique em “Editar texto” para ajustar manualmente ou selecionar um trecho.',
  'email.refineHintEdit':
    'Selecione um trecho no texto para reescrever apenas ele — sem refazer o e-mail inteiro.',
  'email.modelChipFallback': 'Escolher modelo',
  'email.noModel': 'nenhum modelo',
  'email.waitingFirst': 'aguardando a primeira geração',
  'email.receivingTokens': 'recebendo tokens…',
  'email.draftFilename': 'rascunho',
  'email.streamingTitle': 'Streaming: {label}',
  'email.ttft': 'TTFT',
  'email.tokens': 'tok',

  'refine.shorter': 'Mais curto',
  'refine.formal': 'Mais formal',
  'refine.persuasive': 'Mais persuasivo',
  'refine.warmer': 'Mais cordial',
  'refine.cta': 'CTA mais claro',
  'refine.translateToEnglish': 'Traduzir p/ inglês',
  'refine.translateToPortuguese': 'Traduzir p/ português',
  'refine.shorterInstruction':
    'Deixe o corpo mais curto e direto, preservando o pedido principal, os fatos e a assinatura.',
  'refine.formalInstruction':
    'Deixe o tom mais formal e polido, sem ficar rígido ou burocrático.',
  'refine.persuasiveInstruction':
    'Torne o texto mais persuasivo, destacando o valor para o destinatário sem exageros.',
  'refine.warmerInstruction':
    'Deixe o tom mais cordial e empático, mantendo a clareza e o profissionalismo.',
  'refine.ctaInstruction':
    'Deixe o próximo passo (chamada para ação) mais claro, específico e fácil de responder.',
  'refine.translateToEnglishInstruction':
    'Traduza o corpo do e-mail para inglês natural e profissional, mantendo nomes, números, formatação e a assinatura.',
  'refine.translateToPortugueseInstruction':
    'Traduza o corpo do e-mail para português do Brasil natural e profissional, mantendo nomes, números, formatação e a assinatura.',

  'models.eyebrow': '03 · catálogo ao vivo',
  'models.title': 'Modelos Go',
  'models.refresh': 'Atualizar catálogo',
  'models.refreshAria': 'Atualizar catálogo de modelos',
  'models.planAria': 'Plano Go',
  'models.planLimit': 'Limite mensal por modelo',
  'models.planNote':
    'Preços base por 1M de tokens. O limite mensal vale se você usar só este modelo — o consumo é compartilhado.',
  'models.searchPlaceholder': 'Buscar modelo…',
  'models.searchAria': 'Buscar modelo',
  'models.clearSearch': 'Limpar busca',
  'models.filtersAria': 'Filtrar modelos',
  'models.filter.all': 'Todos',
  'models.filter.featured': 'Destaques',
  'models.filter.free': 'Grátis',
  'models.filter.zdr': 'ZDR',
  'models.featuredAria': 'Modelo em destaque',
  'models.badgeFree': 'grátis',
  'models.badgeZdr': 'zdr',
  'models.limitFree': 'não consome o plano',
  'models.limitPerMonth': '{price}/mês no {plan}',
  'models.limitUnknown': 'limite não informado',
  'models.listAria': 'Modelos do OpenCode Go',
  'models.connectTitle': 'Conecte a API',
  'models.connectBody':
    'Cole sua chave do OpenCode Go para carregar os modelos e os preços ao vivo.',
  'models.connectButton': 'Configurar API',
  'models.retry': 'Tentar de novo',
  'models.changeKey': 'Trocar chave',
  'models.noResults': 'Nenhum modelo encontrado com esse filtro.',
  'models.clearFilters': 'Limpar filtros',
  'models.count': '{filtered} de {total}',
  'models.viaEnv': 'via .env',
  'models.viaPanel': 'via painel',
  'models.apiLabel': 'go/v1/models',
  'models.limitTitle':
    '{price} de limite mensal para {model} no {plan}',

  'usage.title': 'consumo do plano',
  'usage.refreshTitle': 'Atualizar consumo do plano',
  'usage.refreshAria': 'Atualizar consumo do plano',
  'usage.console': 'Console',
  'usage.consoleTitle': 'Abrir o OpenCode Console',
  'usage.syncing': 'sincronizando',
  'usage.noKey':
    'Conecte sua chave para acompanhar as janelas reais do Go.',
  'usage.connect': 'Conectar API',
  'usage.window5h': '5 horas',
  'usage.week': 'Semana',
  'usage.month': 'Mês',
  'usage.footRequests': '{count} req.',
  'usage.footTokens': '{input} in · {output} out',
  'usage.footTable': 'tabela {cost}',
  'usage.footPlan': 'plano {cost}',
  'usage.footSession': 'sessão {percent} do limite',
  'usage.unavailable': 'Consumo do plano indisponível para esta chave.',
  'usage.fetching': 'Buscando o consumo do plano…',
  'usage.update': 'Atualizar',
  'usage.ttftTitle': 'Tempo até o primeiro token',
  'usage.tpsTitle': 'Tokens por segundo',

  'key.eyebrow': 'acesso · opencode go',
  'key.title': 'Conectar sua API',
  'key.intro':
    'Cole a API key do seu workspace no OpenCode Console. A validação acontece agora, ao vivo, contra o catálogo Go.',
  'key.label': 'API key',
  'key.already': 'já existe uma chave nesta aba',
  'key.placeholder': 'oc_sk_...',
  'key.show': 'Mostrar chave',
  'key.hide': 'Ocultar chave',
  'key.submit': 'Validar e conectar',
  'key.validating': 'Validando chave…',
  'key.or': 'ou',
  'key.useServer': 'Usar a chave do servidor (.env)',
  'key.remove': 'Remover a chave do painel desta aba',
  'key.helpTitle': 'Como pegar sua chave',
  'key.help1Before': 'Abra o ',
  'key.help1After': ' e entre no workspace com Go ativo.',
  'key.help2Before': 'Acesse ',
  'key.help2After': ' e crie uma chave.',
  'key.help3':
    'Copie a chave (ela aparece só uma vez) e cole aqui.',
  'key.security':
    'A chave do painel fica apenas no sessionStorage desta aba e vai direto para o seu backend local. O servidor não grava sua chave em disco. Para produção, mantenha a chave somente no servidor.',
  'key.successTitle': 'Conectado',
  'key.successModels':
    '{count} modelos disponíveis. Chave validada com sucesso.',
  'key.successServer': 'Usando a chave do servidor (.env).',
  'key.validationFailed': 'Não foi possível validar a chave.',
  'key.serverFailed': 'A chave do servidor não respondeu.',
  'key.close': 'Fechar',
  'key.consoleLink': 'OpenCode Console',
  'key.accountLink': 'Account › Personal API keys',

  'tabs.briefing': 'Briefing',
  'tabs.email': 'E-mail',
  'tabs.models': 'Modelos',
  'tabs.navAria': 'Navegação do estúdio',

  'toast.connectToGenerate':
    'Conecte sua chave do OpenCode Go para gerar.',
  'toast.chooseModel': 'Escolha um modelo no catálogo Go.',
  'toast.describeGoal':
    'Descreva o objetivo do e-mail antes de gerar.',
  'toast.stopped': 'Geração interrompida.',
  'toast.copied': 'E-mail copiado para a área de transferência.',
  'toast.copyFailed':
    'Não foi possível copiar. Selecione o texto manualmente.',
  'toast.downloadStarted': 'Download iniciado.',
  'toast.newDraft': 'Novo rascunho.',
  'toast.panelKeyRemovedServer':
    'Chave do painel removida. Usando a chave do servidor.',
  'toast.panelKeyRemoved': 'Chave do painel removida.',
  'toast.truncated':
    'A resposta atingiu o limite de tokens e pode estar incompleta. Tente novamente.',
  'toast.generic': 'Algo deu errado. Tente novamente.',

  'errors.generic': 'Algo deu errado. Tente novamente.',
  'errors.network':
    'Não foi possível falar com o servidor. Verifique se o backend está rodando (npm run dev ou npm start).',
  'errors.invalid_key':
    'Chave de API inválida ou expirada. Confira a chave no OpenCode Console.',
  'errors.forbidden':
    'Essa chave não tem acesso aos modelos Go. Verifique a assinatura e as permissões da chave.',
  'errors.no_credit':
    'Sem saldo ou limite disponível para este modelo agora.',
  'errors.not_found':
    'Modelo não encontrado no catálogo Go. Atualize a lista de modelos.',
  'errors.rate_limited':
    'Limite de uso atingido. Aguarde a janela renovar ou escolha outro modelo.',
  'errors.upstream_error':
    'A API do OpenCode não respondeu como esperado. Tente novamente em instantes.',
  'errors.network_error':
    'Não foi possível falar com a API do OpenCode. Verifique sua conexão.',
  'errors.missing_key':
    'Nenhuma chave de API configurada. Abra “Configurar API” e cole sua chave do OpenCode Go.',
  'errors.bad_request': 'Corpo da requisição inválido.',
  'errors.invalid_model': 'Escolha um modelo válido do catálogo Go.',
  'errors.missing_topic': 'Descreva o objetivo do e-mail antes de gerar.',
  'errors.missing_body': 'Não há e-mail para refinar.',
  'errors.missing_selection':
    'Selecione um trecho do e-mail para reescrever.',
  'errors.timeout': 'A API demorou demais para responder. Tente novamente.',
  'errors.empty_stream': 'A API não retornou um stream de resposta.',
  'errors.empty_response':
    'O modelo encerrou sem escrever o e-mail. Tente outro modelo ou gere novamente.',
  'errors.stream_error':
    'A conexão com a API foi interrompida. Tente gerar novamente.',
  'errors.bad_json': 'O corpo da requisição não é um JSON válido.',
  'errors.internal_error': 'Erro interno no servidor. Tente novamente.',
  'errors.no_model': 'Nenhum modelo selecionado. Escolha um no catálogo Go.',

  'header.delivery': 'Envio',
  'header.deliveryTitle': 'Configurações de envio da Resend',
  'header.deliveryAria': 'Abrir configurações de envio',
  'email.send': 'Enviar',
  'email.sendTitle': 'Enviar este e-mail pela Resend',
  'email.sendAria': 'Enviar este e-mail',
  'email.sent': 'Enviado',

  'delivery.eyebrow': 'envio · resend',
  'delivery.title': 'Enviar com Resend',
  'delivery.tabs.send': 'Enviar',
  'delivery.tabs.settings': 'Configurações',
  'delivery.provider': 'Provedor',
  'delivery.providerResend': 'Resend',
  'delivery.providerNote':
    'A camada de provedor está pronta para SMTP, Amazon SES e outros adaptadores depois.',
  'delivery.connected': 'Conectado',
  'delivery.notConnected': 'Não conectado',
  'delivery.fullAccess': 'Acesso total',
  'delivery.restricted': 'Chave somente envio',
  'delivery.serverKey': 'Chave do servidor (.env)',
  'delivery.panelKey': 'Chave do painel nesta aba',
  'delivery.loading': 'Carregando…',
  'delivery.retry': 'Tentar novamente',
  'delivery.errorTitle': 'Algo deu errado',
  'delivery.providerDetails': 'Resposta do provedor',
  'delivery.copyId': 'Copiar ID',
  'delivery.copied': 'Copiado',
  'delivery.keyTitle': 'Chave de API da Resend',
  'delivery.keyHelp':
    'Uma chave de Acesso total lista domínios e status de entrega. Uma chave somente envio ainda consegue enviar e-mails. Ao conectar, a chave é validada e salva no .env do servidor.',
  'delivery.keyPlaceholder': 're_...',
  'delivery.keyValidate': 'Validar e conectar',
  'delivery.keyValidating': 'Validando…',
  'delivery.keyUseServer': 'Usar a chave do servidor (.env)',
  'delivery.keyRemove': 'Remover chave do painel',
  'delivery.keySaved': 'Chave validada e salva no .env do servidor.',
  'delivery.keySaveFailed':
    'A chave funciona nesta aba, mas não foi possível salvar no .env do servidor.',
  'delivery.keyInvalid': 'Chave de API da Resend inválida.',
  'delivery.keyRequired': 'Conecte uma chave da Resend para enviar.',
  'delivery.keySection': 'Conexão',
  'delivery.openApiKeys': 'Chaves de API da Resend',
  'delivery.connectTitle': 'Conecte a Resend para enviar e-mails reais',
  'delivery.connectBody':
    'Cole uma chave de API da Resend em Configurações. Ela é validada e salva no .env do servidor local, e passa a ser usada nos envios.',
  'delivery.connectButton': 'Abrir configurações',
  'delivery.domainsTitle': 'Domínios de envio',
  'delivery.domainsRefresh': 'Atualizar domínios',
  'delivery.domainsEmpty':
    'Nenhum domínio nesta conta da Resend. Adicione e verifique um domínio antes de enviar.',
  'delivery.domainsRestricted':
    'Esta chave é somente envio, então os domínios não podem ser listados. Informe o remetente manualmente ou use uma chave de Acesso total.',
  'delivery.domainsHint':
    'Apenas domínios verificados podem ser usados no endereço De.',
  'delivery.addDomain': 'Adicionar domínio na Resend',
  'delivery.domainVerify': 'Verificar',
  'delivery.domainVerifying': 'Verificando…',
  'delivery.domainVerifyStarted':
    'Verificação iniciada. Atualize em alguns segundos.',
  'delivery.domainAria': 'Domínios de envio da Resend',
  'delivery.domainStatus.verified': 'verificado',
  'delivery.domainStatus.pending': 'pendente',
  'delivery.domainStatus.not_started': 'não iniciado',
  'delivery.domainStatus.failed': 'falhou',
  'delivery.domainStatus.temporary_failure': 'verificando',
  'delivery.domainStatus.unknown': 'desconhecido',
  'delivery.senderTitle': 'Identidade do remetente',
  'delivery.fromName': 'Nome do remetente',
  'delivery.fromEmail': 'E-mail do remetente',
  'delivery.fromHint': 'Use um e-mail de um domínio verificado na Resend.',
  'delivery.replyTo': 'Responder para',
  'delivery.replyHint': 'Opcional, mas use uma caixa que você realmente lê.',
  'delivery.autosave': 'As alterações do remetente ficam salvas neste navegador.',
  'delivery.reviewTitle': 'Revisar e enviar',
  'delivery.to': 'Para',
  'delivery.toPlaceholder': 'destinatário@empresa.com',
  'delivery.from': 'De',
  'delivery.subject': 'Assunto',
  'delivery.body': 'Corpo',
  'delivery.changeSender': 'Alterar remetente',
  'delivery.sendButton': 'Enviar e-mail',
  'delivery.sending': 'Enviando…',
  'delivery.sendNote':
    'Isso envia um e-mail real pela Resend. Revise o conteúdo antes de enviar.',
  'delivery.reviewCheckbox':
    'Revisei o conteúdo e quero enviar este e-mail.',
  'delivery.noDraftTitle': 'Gere um e-mail primeiro',
  'delivery.noDraftBody':
    'O rascunho está vazio. Gere ou escreva um e-mail e volte para enviar.',
  'delivery.missingFrom': 'Configure um remetente válido antes de enviar.',
  'delivery.invalidTo': 'Informe um e-mail de destinatário válido.',
  'delivery.sendSuccessTitle': 'E-mail enviado',
  'delivery.sendSuccessBody':
    'A Resend aceitou a mensagem. Acompanhe a entrega em envios recentes.',
  'delivery.sendSuccessId': 'ID na Resend',
  'delivery.done': 'Concluir',
  'delivery.rateNote':
    'Envios desta sessão têm limite de taxa para proteger sua conta.',
  'delivery.testTitle': 'E-mail de teste',
  'delivery.testBody':
    'Envie um teste pequeno usando o remetente e a chave atuais.',
  'delivery.testTo': 'Destinatário do teste',
  'delivery.testButton': 'Enviar teste',
  'delivery.testing': 'Enviando teste…',
  'delivery.testSuccess': 'E-mail de teste enviado. Confira a caixa de entrada.',
  'delivery.testInvalid': 'Informe um destinatário de teste válido.',
  'delivery.testSubject': 'E-mail de teste do PolySend',
  'delivery.testText':
    'Este é um e-mail de teste do PolySend. Se você recebeu, a configuração da Resend está funcionando.',
  'delivery.testFromRequired': 'Configure um remetente válido antes do teste.',
  'delivery.fromNotVerified':
    'O domínio do remetente não está verificado na Resend. Adicione e verifique antes de enviar.',
  'delivery.historyTitle': 'Envios recentes',
  'delivery.historyEmpty': 'Nenhum e-mail enviado desta sessão ainda.',
  'delivery.historyRefresh': 'Atualizar status',
  'delivery.historyFullAccess':
    'É necessário uma chave de Acesso total para atualizar o status de entrega.',
  'delivery.historyError': 'Não foi possível carregar os envios recentes.',
  'delivery.viewDashboard': 'Abrir dashboard da Resend',
  'delivery.status': 'status',
  'delivery.event.accepted': 'aceito',
  'delivery.event.sent': 'enviado',
  'delivery.event.delivered': 'entregue',
  'delivery.event.bounced': 'devolvido',
  'delivery.event.complained': 'reclamação',
  'delivery.event.opened': 'aberto',
  'delivery.event.clicked': 'clicado',
  'delivery.event.delivery_delayed': 'atrasado',
  'delivery.event.failed': 'falhou',
  'delivery.event.scheduled': 'agendado',
  'delivery.event.unknown': 'desconhecido',
  'delivery.security':
    'A chave é enviada somente ao seu backend local e salva no .env (fora do Git), então continua após reiniciar. Proteja o servidor antes de expô-lo publicamente.',
  'delivery.providerReady':
    'Camada de provedor: Resend agora; SMTP, Amazon SES e outros podem ser adicionados depois.',
  'delivery.fullAccessHint':
    'Use uma chave de Acesso total para listar domínios e atualizar o status de entrega.',
  'delivery.testNote': 'Envios de teste também contam no limite por hora.',

  'errors.missing_resend_key':
    'Conecte uma chave da Resend em Envio para enviar e-mails.',
  'errors.resend_invalid_key':
    'A chave da Resend é inválida, inativa ou restrita. Use uma chave válida.',
  'errors.resend_forbidden':
    'A Resend rejeitou o remetente ou o domínio. Confira o domínio verificado e as permissões da chave.',
  'errors.resend_validation':
    'A Resend rejeitou o e-mail. Confira destinatário, remetente, assunto e conteúdo.',
  'errors.resend_rate_limited':
    'Limite de taxa da Resend atingido. Aguarde um instante e tente novamente.',
  'errors.resend_timeout':
    'A Resend demorou demais para responder. Tente novamente.',
  'errors.resend_error':
    'A Resend não conseguiu processar a requisição. Tente novamente.',
  'errors.send_rate_limited':
    'Muitos e-mails enviados desta sessão. Aguarde alguns minutos e tente novamente.',
  'errors.invalid_recipient': 'Informe um e-mail de destinatário válido.',
  'errors.invalid_sender': 'Informe um e-mail de remetente válido.',
  'errors.invalid_reply_to': 'Informe um e-mail de Responder para válido.',
  'errors.missing_subject': 'Informe um assunto antes de enviar.',
  'errors.missing_email_body': 'O corpo do e-mail está vazio.',
  'errors.invalid_domain': 'Domínio inválido.',
  'errors.email_not_found': 'Este e-mail não está no histórico desta sessão.',
};

export type Translate = (key: MessageKey, vars?: Record<string, string | number>) => string;

const STORAGE_KEY = 'polysend_locale';

const dictionaries: Record<Locale, Record<MessageKey, string>> = {
  en,
  'pt-BR': pt,
};

export function isMessageKey(key: string): key is MessageKey {
  return key in en;
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = vars[name];
    return value == null ? match : String(value);
  });
}

function readLocale(): Locale {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'pt-BR' ? 'pt-BR' : 'en';
  } catch {
    return 'en';
  }
}

interface I18nValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() =>
    typeof window === 'undefined' ? 'en' : readLocale(),
  );

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale);
    try {
      window.localStorage.setItem(STORAGE_KEY, nextLocale);
    } catch {
      /* noop */
    }
  }, []);

  const t = useCallback<Translate>(
    (key, vars) => interpolate(dictionaries[locale][key] ?? dictionaries.en[key], vars),
    [locale],
  );

  useEffect(() => {
    document.documentElement.lang = locale === 'pt-BR' ? 'pt-BR' : 'en';
    document.title = t('meta.title');
    const description = document.querySelector('meta[name="description"]');
    if (description) description.setAttribute('content', t('meta.description'));
  }, [locale, t]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
