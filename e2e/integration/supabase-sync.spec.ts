/**
 * Tests d'INTÉGRATION réel-cloud de la couche de sync (vraie base Supabase).
 *
 * Contrairement à e2e/sync-logic.spec.ts (faux client, aucun réseau), ces tests
 * frappent un VRAI projet Supabase de TEST dédié et vérifient les contrats de
 * persistance que le faux client ne peut pas prouver : commit d'un UPDATE,
 * tombstone soft-delete réellement stocké, résurrection par upsert, last-write-wins
 * au niveau base, et livraison Realtime (postgres_changes).
 *
 * ⚠️ AUCUN code applicatif n'est importé ni modifié : on parle directement à la
 * base avec @supabase/supabase-js (déjà une dépendance) pour exercer le schéma
 * (supabase/schema.sql + supabase/soft-delete.sql).
 *
 * AUTO-SKIP : sans les 3 variables d'env SUPABASE_TEST_*, tout le groupe est
 * `describe.skip` → la suite e2e normale reste 100 % verte sans configuration.
 * Voir supabase/test-project.md pour créer le projet de test + poser les secrets.
 *
 * ISOLATION : chaque run crée un utilisateur auth jetable (owner_id est une FK
 * NOT NULL vers auth.users → un uuid arbitraire violerait la contrainte) et un
 * arbre dédié à id aléatoire. afterAll supprime l'arbre (cascade sur les enfants)
 * puis l'utilisateur — ce hard-delete ne concerne QUE des données de test créées
 * par ce fichier (le soft-delete ne s'applique qu'aux chemins applicatifs).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { test, expect } from '@playwright/test';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// --- Auto-skip : n'exécuter que si l'env d'intégration est présent ----------
const URL = process.env.SUPABASE_TEST_URL;
const ANON = process.env.SUPABASE_TEST_ANON_KEY;
const SERVICE = process.env.SUPABASE_TEST_SERVICE_KEY;
const RUN = !!URL && !!ANON && !!SERVICE;

// Groupe entier sauté (describe.skip) quand l'env est absent : aucun createClient
// n'est appelé au chargement du module, donc rien ne casse sans configuration.
const describeIntegration = RUN ? test.describe : test.describe.skip;

describeIntegration('Supabase real-cloud sync', () => {
  // Client privilégié (service_role) : bypass RLS pour le setup/teardown et les
  // écritures de test (l'anon-key exige une session authentifiée pour écrire).
  let admin: SupabaseClient;
  let ownerId: string; // uuid d'un auth.users jetable, satisfait la FK trees.owner_id
  let treeId: string; // arbre de test isolé

  test.beforeAll(async () => {
    admin = createClient(URL!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Créer un utilisateur auth jetable : trees.owner_id référence auth.users(id)
    // (NOT NULL) → impossible d'insérer un arbre sans un vrai user id.
    const email = `sync-test-${crypto.randomUUID()}@example.com`;
    const { data: created, error: userErr } = await admin.auth.admin.createUser({
      email,
      password: crypto.randomUUID(),
      email_confirm: true,
    });
    if (userErr || !created.user) throw new Error(`création user test échouée: ${userErr?.message}`);
    ownerId = created.user.id;

    treeId = `test-tree-${crypto.randomUUID()}`;
    const { error: treeErr } = await admin
      .from('trees')
      .insert({ id: treeId, owner_id: ownerId, name: 'Integration Test Tree' });
    if (treeErr) throw new Error(`insert arbre test échoué: ${treeErr.message}`);
  });

  test.afterAll(async () => {
    if (!admin) return;
    // Teardown : hard-delete de l'arbre de TEST (cascade FK → persons /
    // relationships / journal_entries), puis de l'utilisateur jetable. Ce DELETE
    // dur ne touche QUE des données créées ici — le soft-delete reste réservé aux
    // chemins applicatifs.
    if (treeId) await admin.from('trees').delete().eq('id', treeId);
    if (ownerId) await admin.auth.admin.deleteUser(ownerId);
  });

  // 1. INSERT via upsert → SELECT → persistence ------------------------------
  test('1. upsert insère une personne, un SELECT la retrouve', async () => {
    const id = `p-${crypto.randomUUID()}`;
    const { error: upErr } = await admin
      .from('persons')
      .upsert({ id, tree_id: treeId, first_name: 'Awa', last_name: 'Diop' });
    expect(upErr).toBeNull();

    const { data, error } = await admin
      .from('persons')
      .select('id, first_name, last_name')
      .eq('id', id)
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ id, first_name: 'Awa', last_name: 'Diop' });
  });

  // 2. UPDATE → SELECT → nouvelle valeur committée ---------------------------
  test('2. update est committé (une relecture voit la nouvelle valeur)', async () => {
    const id = `p-${crypto.randomUUID()}`;
    await admin.from('persons').upsert({ id, tree_id: treeId, first_name: 'Ancien' });

    const { error: updErr } = await admin
      .from('persons')
      .update({ first_name: 'Nouveau', occupation: 'Griot' })
      .eq('id', id);
    expect(updErr).toBeNull();

    const { data } = await admin
      .from('persons')
      .select('first_name, occupation')
      .eq('id', id)
      .single();
    expect(data).toMatchObject({ first_name: 'Nouveau', occupation: 'Griot' });
  });

  // 3. Soft-delete : tombstone, ligne toujours présente ----------------------
  test('3. soft-delete pose deleted_at sans retirer la ligne', async () => {
    const id = `p-${crypto.randomUUID()}`;
    await admin.from('persons').upsert({ id, tree_id: treeId, first_name: 'Tombstone' });

    const { error: delErr } = await admin
      .from('persons')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id);
    expect(delErr).toBeNull();

    // La ligne existe TOUJOURS en base (soft-delete), avec deleted_at non-null.
    const { data } = await admin
      .from('persons')
      .select('id, deleted_at')
      .eq('id', id)
      .single();
    expect(data).not.toBeNull();
    expect(data!.deleted_at).not.toBeNull();
  });

  // 4. Contrat de résurrection : upsert deleted_at:null ranime une tombstone --
  test('4. un upsert deleted_at:null ranime une personne soft-deletée', async () => {
    const id = `p-${crypto.randomUUID()}`;
    await admin.from('persons').upsert({ id, tree_id: treeId, first_name: 'Revive' });
    // Poser la tombstone…
    await admin.from('persons').update({ deleted_at: new Date().toISOString() }).eq('id', id);

    // … puis l'écriture applicative « présent localement = vivant » (pushChildTable
    // ré-upsert chaque ligne locale avec deleted_at: null → un undo la ranime).
    const { error: reviveErr } = await admin
      .from('persons')
      .upsert({ id, tree_id: treeId, first_name: 'Revive', deleted_at: null });
    expect(reviveErr).toBeNull();

    const { data } = await admin
      .from('persons')
      .select('id, deleted_at')
      .eq('id', id)
      .single();
    expect(data!.deleted_at).toBeNull(); // ressuscitée

    // ⚠️ Ce contrat de résurrection est INTENTIONNEL au niveau base : la base ne
    // connaît pas l'horodatage relatif d'une suppression vs d'une édition. C'est la
    // couche de détection de conflit (Agent 2, côté client) qui compare la fraîcheur
    // du soft-delete à celle de l'upsert local et EMPÊCHE cette résurrection quand la
    // suppression est plus récente que la dernière édition locale. Sans elle, un cache
    // périmé ré-upsertant une personne récemment supprimée ailleurs la ferait revivre.
  });

  // 5. edit-vs-edit last-write-wins (au niveau base) -------------------------
  test('5. last-write-wins : la dernière écriture est ce que renvoie un SELECT frais', async () => {
    const id = `p-${crypto.randomUUID()}`;
    await admin.from('persons').upsert({ id, tree_id: treeId, first_name: 'Base' });

    // Deux "clients" distincts (même privilège) éditent la même ligne. La base
    // n'a AUCUNE résolution de conflit : la dernière écriture exécutée gagne,
    // indépendamment de la valeur d'updated_at (que l'app pose pour SON propre
    // merge côté client). On exécute donc B après A pour rendre le test déterministe.
    const clientA = createClient(URL!, SERVICE!, { auth: { persistSession: false } });
    const clientB = createClient(URL!, SERVICE!, { auth: { persistSession: false } });

    const tEarly = '2020-01-01T00:00:00.000Z';
    const tLate = '2030-01-01T00:00:00.000Z';

    await clientA.from('persons').update({ first_name: 'ÉditionA', updated_at: tEarly }).eq('id', id);
    await clientB.from('persons').update({ first_name: 'ÉditionB', updated_at: tLate }).eq('id', id);

    const { data } = await admin
      .from('persons')
      .select('first_name, updated_at')
      .eq('id', id)
      .single();
    expect(data!.first_name).toBe('ÉditionB');
    expect(data!.updated_at).toBe(tLate);
  });

  // 6. Realtime : postgres_changes filtré par tree_id ------------------------
  test('6. Realtime : un UPDATE d’un second client est reçu par un abonné', async () => {
    const id = `p-${crypto.randomUUID()}`;
    await admin.from('persons').insert({ id, tree_id: treeId, first_name: 'Rt' });

    // Client abonné distinct (service_role → bypass RLS : la livraison Realtime
    // respecte RLS, un anon sans session ne recevrait rien).
    const subscriber = createClient(URL!, SERVICE!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const received = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('aucun événement Realtime reçu dans le délai')),
        15_000,
      );
      subscriber
        .channel(`persons-${id}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'persons', filter: `tree_id=eq.${treeId}` },
          (payload) => {
            clearTimeout(timer);
            resolve(payload);
          },
        )
        .subscribe((status) => {
          // Ne déclencher l'écriture qu'une fois l'abonnement établi, sinon
          // l'événement partirait avant que le canal n'écoute.
          if (status === 'SUBSCRIBED') {
            admin
              .from('persons')
              .update({ first_name: 'RtUpdated' })
              .eq('id', id)
              .then(() => {});
          }
        });
    });

    try {
      const payload = await received;
      expect(payload.eventType).toBe('UPDATE');
      expect(payload.new.first_name).toBe('RtUpdated');
    } finally {
      await subscriber.removeAllChannels();
    }
  });
});
