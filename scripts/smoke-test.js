// Smoke test do api-hub: bate em cada endpoint publicado e confere se a
// resposta é JSON válido com os campos que o frontend (hub) espera. Não
// substitui teste unitário, é só pra pegar se algo caiu ou mudou de formato.
//
// node scripts/smoke-test.js -> testa produção (Vercel)
// BASE_URL=http://localhost:3000 node scripts/smoke-test.js -> testa local
//
// /api/gemini e /api/admin/verify são sensíveis (gastam cota do Gemini ou
// exigem login real), então só testamos a guarda deles (método errado,
// sem token), nunca a chamada de verdade.

const BASE_URL = process.env.BASE_URL || 'https://kennowiski-api-hub.vercel.app';

const results = [];

async function request(path, options = {}) {
    const url = BASE_URL + path;
    const startedAt = Date.now();

    try {
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: options.headers || {},
            body: options.body,
            signal: AbortSignal.timeout(15000)
        });

        const durationMs = Date.now() - startedAt;
        const text = await response.text();

        let json = null;
        let parseError = null;

        if (text) {
            try {
                json = JSON.parse(text);
            } catch (error) {
                parseError = error.message;
            }
        }

        return { ok: true, status: response.status, json, text, parseError, durationMs };
    } catch (error) {
        return {
            ok: false,
            status: null,
            json: null,
            text: '',
            parseError: null,
            durationMs: Date.now() - startedAt,
            networkError: error.message
        };
    }
}

async function check(name, path, options, validate) {
    const response = await request(path, options);
    let failReason = null;

    if (!response.ok) {
        failReason = 'Falha de rede: ' + response.networkError;
    } else if (response.parseError) {
        failReason = 'Resposta não é JSON válido: ' + response.parseError;
    } else {
        try {
            const validationResult = validate(response);
            if (validationResult !== true) {
                failReason = validationResult || 'Falhou na validação (motivo não informado)';
            }
        } catch (error) {
            failReason = 'Validador lançou erro: ' + error.message;
        }
    }

    const passed = failReason === null;

    results.push({
        name,
        path,
        passed,
        failReason,
        status: response.status,
        durationMs: response.durationMs
    });

    const statusLabel = response.status !== null ? response.status : '(sem resposta)';
    const timeLabel = response.durationMs + 'ms';

    if (passed) {
        console.log(`  OK   ${name}  [${statusLabel}, ${timeLabel}]`);
    } else {
        console.log(`  FAIL ${name}  [${statusLabel}, ${timeLabel}]`);
        console.log(`       -> ${failReason}`);
    }
}

function hasKey(obj, key) {
    return obj && typeof obj === 'object' && key in obj;
}

async function main() {
    console.log(`Testando api-hub em: ${BASE_URL}\n`);

    // /api/letterboxd — frontend lê: title, poster, link (ou error)
    await check('Letterboxd', '/api/letterboxd', {}, (res) => {
        if (res.status !== 200) return `Esperava HTTP 200, veio ${res.status}`;
        if (hasKey(res.json, 'error')) return true; // sem filme no momento é um estado válido
        if (!hasKey(res.json, 'title') || !hasKey(res.json, 'poster')) {
            return 'Resposta sem "title"/"poster" e sem "error" — formato inesperado';
        }
        return true;
    });

    // /api/simkl — frontend lê: show, season, episodeNumber, episode, rating, genres, poster (ou error)
    await check('Simkl', '/api/simkl', {}, (res) => {
        if (res.status !== 200) return `Esperava HTTP 200, veio ${res.status}`;
        if (hasKey(res.json, 'error')) return true; // sem histórico/credencial inválida é reportado, não é crash
        if (!hasKey(res.json, 'show') || !hasKey(res.json, 'episodeNumber')) {
            return 'Resposta sem "show"/"episodeNumber" e sem "error" — formato inesperado';
        }
        return true;
    });

    // /api/spotify — frontend lê: isPlaying, title, artist, albumImageUrl (ou error)
    await check('Spotify', '/api/spotify', {}, (res) => {
        if (res.status !== 200) return `Esperava HTTP 200, veio ${res.status}`;
        if (hasKey(res.json, 'error')) return true;
        if (!hasKey(res.json, 'isPlaying')) {
            return 'Resposta sem "isPlaying" e sem "error" — formato inesperado';
        }
        return true;
    });

    // /api/lastfm — sempre 200, frontend lê: provider, tracks[]
    await check('Last.fm', '/api/lastfm?limit=1', {}, (res) => {
        if (res.status !== 200) return `Esperava HTTP 200, veio ${res.status}`;
        if (res.json?.provider !== 'lastfm') return 'Campo "provider" ausente ou diferente de "lastfm"';
        if (!Array.isArray(res.json?.tracks)) return 'Campo "tracks" ausente ou não é array';
        return true;
    });

    // /api/gemini — só testa as guardas (método e CORS), nunca a chamada real
    await check('Gemini (OPTIONS)', '/api/gemini', { method: 'OPTIONS' }, (res) => {
        if (res.status !== 204) return `Esperava HTTP 204 no preflight, veio ${res.status}`;
        return true;
    });

    await check('Gemini (método errado)', '/api/gemini', { method: 'GET' }, (res) => {
        if (res.status !== 405) return `Esperava HTTP 405 para GET, veio ${res.status}`;
        return true;
    });

    // /api/admin/verify — só testa a guarda de autenticação, sem token real
    await check('Admin verify (OPTIONS)', '/api/admin/verify', { method: 'OPTIONS' }, (res) => {
        if (res.status !== 204) return `Esperava HTTP 204 no preflight, veio ${res.status}`;
        return true;
    });

    await check('Admin verify (sem token)', '/api/admin/verify', {}, (res) => {
        if (res.status !== 401) return `Esperava HTTP 401 sem token, veio ${res.status}`;
        if (res.json?.allowed !== false) return 'Campo "allowed" deveria ser false';
        return true;
    });

    const total = results.length;
    const passed = results.filter((r) => r.passed).length;
    const failed = total - passed;

    console.log('\n' + '-'.repeat(40));
    console.log(`${passed}/${total} testes passaram`);

    if (failed > 0) {
        console.log(`${failed} falharam:`);
        results.filter((r) => !r.passed).forEach((r) => {
            console.log(`  - ${r.name}: ${r.failReason}`);
        });
        process.exitCode = 1;
    }
}

main();
