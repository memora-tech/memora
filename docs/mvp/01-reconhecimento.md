# Relatório de Reconhecimento: Protótipo Mock → MVP Real

**Data:** 12/11/2026  
**Objetivo:** Mapeamento integral da arquitetura do protótipo Memora, chamadas de API, dependências, vulnerabilidades serverless e plano de migração para o MVP de ~5 testadores adultos.  
**Premissas:** Foco exclusivo no aplicativo do aluno; prazo 14/11/2026; preservação de contratos de API ([CONTRIBUTING.md](file:///c:/Users/lusco/OneDrive/Desktop/memora/CONTRIBUTING.md)); sem quebra de código legado via deleção.

---

## 1. Chamadas de API do App do Aluno (`frontend/src`) vs Rotas Backend

No frontend, as chamadas do aluno são centralizadas em `studentApi` ([frontend/src/lib/api.js:67](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/lib/api.js#L67)), além de 2 chamadas públicas em `publicApi` ([frontend/src/lib/api.js:72](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/lib/api.js#L72)).

Foram identificados **157 pontos de chamada via `studentApi`** no frontend, cobrindo **120 endpoints únicos**.

### 1.1 Resumo de Cobertura
- **Rotas chamadas pelo front que NÃO existem no backend:** **0** (Todas as chamadas do frontend possuem rota implementada correspondente no backend mock).
- **Rotas existentes no backend que o front do aluno NÃO usa diretamente:** **62 rotas** (compostas em sua maioria pelos painéis Admin, B2B, Parental, Parceiro e endpoints auxiliares de materiais/mcp).

---

### 1.2 Mapeamento Completo das Chamadas do Aluno (`studentApi`)

| Método | Caminho da API | Arquivo e Linha (Frontend) | Rota Backend Atendida | Arquivo e Linha (Backend) |
|---|---|---|---|---|
| `GET` | `/_proto/state` | [ProtoContext.jsx:22](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/ProtoContext.jsx#L22) | `GET /_proto/state` | [proto.js:25](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/proto.js#L25) |
| `POST` | `/_proto/notification` | [ProtoContext.jsx:42](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/ProtoContext.jsx#L42) | `POST /_proto/notification` | [proto.js:58](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/proto.js#L58) |
| `POST` | `/_proto/profile` | [ProtoContext.jsx:49](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/ProtoContext.jsx#L49) | `POST /_proto/profile` | [proto.js:37](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/proto.js#L37) |
| `POST` | `/_proto/coupon-available` | [ProtoContext.jsx:58](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/ProtoContext.jsx#L58) | `POST /_proto/coupon-available` | [proto.js:45](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/proto.js#L45) |
| `POST` | `/_proto/reset` | [ProtoContext.jsx:66](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/ProtoContext.jsx#L66) | `POST /_proto/reset` | [proto.js:31](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/proto.js#L31) |
| `GET` | `/me` | [SessionContext.jsx:46](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/SessionContext.jsx#L46) | `GET /me` | [me.js:14](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/me.js#L14) |
| `POST` | `/auth/login` | [SessionContext.jsx:81](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/SessionContext.jsx#L81) | `POST /auth/login` | [auth.js:10](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/auth.js#L10) |
| `POST` | `/auth/register` | [SessionContext.jsx:91](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/SessionContext.jsx#L91) | `POST /auth/register` | [auth.js:29](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/auth.js#L29) |
| `POST` | `/auth/confirm` | [SessionContext.jsx:99](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/SessionContext.jsx#L99) | `POST /auth/confirm` | [auth.js:77](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/auth.js#L77) |
| `POST` | `/auth/resend` | [SessionContext.jsx:104](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/SessionContext.jsx#L104) | `POST /auth/resend` | [auth.js:93](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/auth.js#L93) |
| `POST` | `/auth/age-verification` | [SessionContext.jsx:107](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/SessionContext.jsx#L107) | `POST /auth/age-verification` | [auth.js:102](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/auth.js#L102) |
| `POST` | `/auth/onboarding` | [SessionContext.jsx:114](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/SessionContext.jsx#L114) | `POST /auth/onboarding` | [auth.js:116](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/auth.js#L116) |
| `POST` | `/auth/logout` | [SessionContext.jsx:123](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/SessionContext.jsx#L123) | `POST /auth/logout` | [auth.js:126](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/auth.js#L126) |
| `POST` | `/auth/password/recover` | [RecoverPage.jsx:21](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/auth/RecoverPage.jsx#L21) | `POST /auth/password/recover` | [auth.js:133](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/auth.js#L133) |
| `PATCH` | `/me/settings` | [SessionContext.jsx:135](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/SessionContext.jsx#L135), [SettingsPage.jsx:55](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/SettingsPage.jsx#L55) | `PATCH /me/settings` | [me.js:18](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/me.js#L18) |
| `PATCH` | `/me/consents` | [SessionContext.jsx:142](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/SessionContext.jsx#L142), [SettingsPage.jsx:62](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/SettingsPage.jsx#L62) | `PATCH /me/consents` | [me.js:81](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/me.js#L81) |
| `GET` | `/study/today` | [StudyContext.jsx:120](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/StudyContext.jsx#L120) | `GET /study/today` | [study.js:27](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L27) |
| `GET` | `/noa/catalog` | [StudyContext.jsx:144](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/StudyContext.jsx#L144) | `GET /noa/catalog` | [noa.js:11](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/noa.js#L11) |
| `POST` | `/reviews` | [StudyContext.jsx:177](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/StudyContext.jsx#L177), [offlineQueue.js:24](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/lib/offlineQueue.js#L24) | `POST /reviews` | [study.js:63](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L63) |
| `POST` | `/study/fatigue` | [StudyContext.jsx:255](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/StudyContext.jsx#L255) | `POST /study/fatigue` | [study.js:125](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L125) |
| `POST` | `/noa/suggestions/:id/respond` | [StudyContext.jsx:268](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/StudyContext.jsx#L268), [NoaHub.jsx:54](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/noa/NoaHub.jsx#L54) | `POST /noa/suggestions/:id/respond` | [noa.js:52](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/noa.js#L52) |
| `POST` | `/study/complete` | [StudyContext.jsx:294](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/StudyContext.jsx#L294) | `POST /study/complete` | [study.js:132](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L132) |
| `POST` | `/study/skip` | [StudyContext.jsx:325](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/StudyContext.jsx#L325) | `POST /study/skip` | [study.js:154](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L154) |
| `POST` | `/study/undo-skip` | [StudyContext.jsx:326](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/StudyContext.jsx#L326) | `POST /study/undo-skip` | [study.js:166](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L166) |
| `POST` | `/study/pause` | [StudyContext.jsx:327](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/StudyContext.jsx#L327) | `POST /study/pause` | [study.js:174](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L174) |
| `POST` | `/study/resume` | [StudyContext.jsx:329](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/StudyContext.jsx#L329) | `POST /study/resume` | [study.js:183](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L183) |
| `PATCH` | `/study/goal` | [StudyContext.jsx:336](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/StudyContext.jsx#L336) | `PATCH /study/goal` | [study.js:192](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L192) |
| `PATCH` | `/study/plan` | [StudyContext.jsx:337](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/StudyContext.jsx#L337) | `PATCH /study/plan` | [study.js:203](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L203) |
| `GET` | `/generation/jobs/:id` | [LayoutBanners.jsx:25](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/areas/student/LayoutBanners.jsx#L25), [GenerationProgress.jsx:32](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/create/GenerationProgress.jsx#L32), [GenerationReview.jsx:69](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/create/GenerationReview.jsx#L69) | `GET /generation/jobs/:id` | [generation.js:200](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js#L200) |
| `GET` | `/wallet` | [StudentLayout.jsx:56](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/areas/student/StudentLayout.jsx#L56), [WalletPage.jsx:110](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/wallet/WalletPage.jsx#L110), [ProfileHome.jsx:22](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/ProfileHome.jsx#L22) | `GET /wallet` | [wallet.js:14](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/wallet.js#L14) |
| `GET` | `/community/authors/:id` | [AuthorProfile.jsx:17](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/AuthorProfile.jsx#L17) | `GET /community/authors/:id` | [community.js:228](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L228) |
| `POST` | `/community/authors/:id/follow` | [AuthorProfile.jsx:24](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/AuthorProfile.jsx#L24), [CommunityDeck.jsx:345](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommunityDeck.jsx#L345) | `POST /community/authors/:id/follow` | [community.js:239](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L239) |
| `GET` | `/community/decks/:id/comments` | [Comments.jsx:178](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Comments.jsx#L178), [CommentsSheet.jsx:25](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommentsSheet.jsx#L25) | `GET /community/decks/:id/comments` | [community.js:250](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L250) |
| `POST` | `/community/decks/:id/comments` | [Comments.jsx:20](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Comments.jsx#L20), [CommentsSheet.jsx:43](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommentsSheet.jsx#L43) | `POST /community/decks/:id/comments` | [community.js:259](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L259) |
| `GET` | `/community/materials/:id/comments`| [Comments.jsx:178](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Comments.jsx#L178), [CommentsSheet.jsx:25](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommentsSheet.jsx#L25) | `GET /community/materials/:id/comments` | [materials.js:118](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js#L118) |
| `POST` | `/community/materials/:id/comments`| [Comments.jsx:20](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Comments.jsx#L20), [CommentsSheet.jsx:43](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommentsSheet.jsx#L43) | `POST /community/materials/:id/comments` | [materials.js:127](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js#L127) |
| `POST` | `/community/comments/:id/like` | [Comments.jsx:214](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Comments.jsx#L214) | `POST /community/comments/:id/like` | [community.js:283](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L283) |
| `POST` | `/community/comments/:id/report` | [Comments.jsx:223](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Comments.jsx#L223), [CommentsSheet.jsx:60](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommentsSheet.jsx#L60) | `POST /community/comments/:id/report` | [community.js:296](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L296) |
| `GET` | `/community/decks/:id` | [CommunityDeck.jsx:22](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommunityDeck.jsx#L22) | `GET /community/decks/:id` | [community.js:103](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L103) |
| `POST` | `/community/decks/:id/favorite` | [CommunityDeck.jsx:60](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommunityDeck.jsx#L60), [Timeline.jsx:182](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Timeline.jsx#L182) | `POST /community/decks/:id/favorite` | [community.js:115](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L115) |
| `POST` | `/community/decks/:id/clone` | [CommunityDeck.jsx:79](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommunityDeck.jsx#L79) | `POST /community/decks/:id/clone` | [community.js:125](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L125) |
| `POST` | `/community/decks/:id/vote` | [CommunityDeck.jsx:100](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommunityDeck.jsx#L100) | `POST /community/decks/:id/vote` | [community.js:151](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L151) |
| `POST` | `/community/decks/:id/react` | [CommunityDeck.jsx:118](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommunityDeck.jsx#L118), [Timeline.jsx:130](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Timeline.jsx#L130) | `POST /community/decks/:id/react` | [community.js:168](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L168) |
| `POST` | `/community/decks/:id/share` | [CommunityDeck.jsx:127](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommunityDeck.jsx#L127) | `POST /community/decks/:id/share` | [community.js:189](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L189) |
| `POST` | `/community/decks/:id/report` | [CommunityDeck.jsx:158](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommunityDeck.jsx#L158) | `POST /community/decks/:id/report` | [community.js:197](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L197) |
| `POST` | `/community/decks/:id/translate` | [CommunityDeck.jsx:180](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommunityDeck.jsx#L180) | `POST /community/decks/:id/translate` | [community.js:206](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L206) |
| `POST` | `/community/decks/:id/study-start`| [CommunityDeck.jsx:198](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommunityDeck.jsx#L198) | `POST /community/decks/:id/study-start` | [community.js:219](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L219) |
| `GET` | `/community/feed` | [CommunityHome.jsx:266](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommunityHome.jsx#L266), [CommunityNow.jsx:15](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommunityNow.jsx#L15) | `GET /community/feed` | [community.js:18](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L18) |
| `GET` | `/community/groups` | [CommunityHome.jsx:267](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommunityHome.jsx#L267), [Groups.jsx:116](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Groups.jsx#L116) | `GET /community/groups` | [community.js:311](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L311) |
| `POST` | `/community/groups/:id/join` | [Groups.jsx:101](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Groups.jsx#L101) | `POST /community/groups/:id/join` | [community.js:324](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L324) |
| `POST` | `/community/groups/:id/posts` | [Groups.jsx:200](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Groups.jsx#L200) | `POST /community/groups/:id/posts` | [community.js:358](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L358) |
| `POST` | `/community/group-posts/:id/like` | [Groups.jsx:213](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Groups.jsx#L213) | `POST /community/group-posts/:id/like` | [community.js:376](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L376) |
| `GET` | `/community/groups/:id` | [Groups.jsx:310](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Groups.jsx#L310) | `GET /community/groups/:id` | [community.js:338](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L338) |
| `GET` | `/community/materials/:id` | [MaterialView.jsx:27](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/MaterialView.jsx#L27), [BlogEditor.jsx:27](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/BlogEditor.jsx#L27) | `GET /community/materials/:id` | [materials.js:14](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js#L14) |
| `POST` | `/community/materials/:id/favorite` | [MaterialView.jsx:44](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/MaterialView.jsx#L44), [Timeline.jsx:182](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Timeline.jsx#L182) | `POST /community/materials/:id/favorite` | [materials.js:24](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js#L24) |
| `POST` | `/community/materials/:id/react` | [MaterialView.jsx:60](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/MaterialView.jsx#L60), [Timeline.jsx:130](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Timeline.jsx#L130) | `POST /community/materials/:id/react` | [materials.js:38](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js#L38) |
| `POST` | `/community/materials/:id/report` | [MaterialView.jsx:74](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/MaterialView.jsx#L74) | `POST /community/materials/:id/report` | [materials.js:61](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js#L61) |
| `POST` | `/me/materials/:id/publish` | [MyContents.jsx:26](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/MyContents.jsx#L26) | `POST /me/materials/:id/publish` | [materials.js:174](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js#L174) |
| `DELETE` | `/me/materials/:id` | [MyContents.jsx:88](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/MyContents.jsx#L88) | `DELETE /me/materials/:id` | [materials.js:195](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js#L195) |
| `POST` | `/me/materials/:id/unpublish` | [MyContents.jsx:112](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/MyContents.jsx#L112) | `POST /me/materials/:id/unpublish` | [materials.js:186](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js#L186) |
| `GET` | `/me/publications` | [MyContents.jsx:130](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/MyContents.jsx#L130) | `GET /me/publications` | [me.js:69](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/me.js#L69) |
| `POST` | `/community/materials/:id/quiz-attempts` | [QuizTimeline.jsx:129](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/QuizTimeline.jsx#L129) | `POST /community/materials/:id/quiz-attempts` | [materials.js:70](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js#L70) |
| `POST` | `/community/materials/:id/quiz-review` | [QuizTimeline.jsx:141](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/QuizTimeline.jsx#L141) | `POST /community/materials/:id/quiz-review` | [materials.js:93](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js#L93) |
| `GET` | `/community/search` | [SearchResults.jsx:45](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/SearchResults.jsx#L45) | `GET /community/search` | [community.js:71](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js#L71) |
| `GET` | `/mcp/connections` | [CreatePage.jsx:31](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/create/CreatePage.jsx#L31), [NoaHub.jsx:27](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/noa/NoaHub.jsx#L27), [McpConnect.jsx:18](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/McpConnect.jsx#L18) | `GET /mcp/connections` | [mcp.js:11](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/mcp.js#L11) |
| `GET` | `/generation/quota` | [CreatePage.jsx:94](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/create/CreatePage.jsx#L94) | `GET /generation/quota` | [generation.js:129](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js#L129) |
| `POST` | `/generation/jobs` | [CreatePage.jsx:143](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/create/CreatePage.jsx#L143) | `POST /generation/jobs` | [generation.js:142](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js#L142) |
| `POST` | `/generation/jobs/:id/approve` | [CreatePage.jsx:144](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/create/CreatePage.jsx#L144), [GenerationReview.jsx:114](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/create/GenerationReview.jsx#L114) | `POST /generation/jobs/:id/approve` | [generation.js:253](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js#L253) |
| `POST` | `/generation/jobs/:id/scope` | [GenerationProgress.jsx:54](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/create/GenerationProgress.jsx#L54) | `POST /generation/jobs/:id/scope` | [generation.js:206](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js#L206) |
| `POST` | `/generation/jobs/:id/retry` | [GenerationProgress.jsx:67](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/create/GenerationProgress.jsx#L67) | `POST /generation/jobs/:id/retry` | [generation.js:226](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js#L226) |
| `POST` | `/generation/jobs/:id/cancel` | [GenerationProgress.jsx:79](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/create/GenerationProgress.jsx#L79) | `POST /generation/jobs/:id/cancel` | [generation.js:242](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js#L242) |
| `GET` | `/decks` | [GenerationReview.jsx:69](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/create/GenerationReview.jsx#L69), [DecksLibrary.jsx:61](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/DecksLibrary.jsx#L61), [ProfileHome.jsx:21](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/ProfileHome.jsx#L21) | `GET /decks` | [decks.js:27](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L27) |
| `GET` | `/decks/:id` | [DeckDetail.jsx:26](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/DeckDetail.jsx#L26) | `GET /decks/:id` | [decks.js:54](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L54) |
| `PATCH` | `/decks/:id` | [DeckDetail.jsx:43](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/DeckDetail.jsx#L43), [DeckDetail.jsx:136](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/DeckDetail.jsx#L136), [StudySession.jsx:181](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/study/StudySession.jsx#L181) | `PATCH /decks/:id` | [decks.js:71](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L71) |
| `PATCH` | `/decks/:id/cards/:cardId` | [DeckDetail.jsx:59](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/DeckDetail.jsx#L59) | `PATCH /decks/:id/cards/:cardId` | [decks.js:91](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L91) |
| `DELETE` | `/decks/:id/cards/:cardId` | [DeckDetail.jsx:73](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/DeckDetail.jsx#L73) | `DELETE /decks/:id/cards/:cardId` | [decks.js:104](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L104) |
| `POST` | `/folders` | [DecksLibrary.jsx:128](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/DecksLibrary.jsx#L128), [FolderSheet.jsx:32](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/FolderSheet.jsx#L32) | `POST /folders` | [decks.js:180](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L180) |
| `GET` | `/folders/:id` | [FolderDetail.jsx:20](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/FolderDetail.jsx#L20) | `GET /folders/:id` | [decks.js:166](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L166) |
| `DELETE` | `/folders/:id` | [FolderDetail.jsx:62](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/FolderDetail.jsx#L62) | `DELETE /folders/:id` | [decks.js:192](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L192) |
| `POST` | `/folders/:id/decks` | [FolderDetail.jsx:69](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/FolderDetail.jsx#L69) | `POST /folders/:id/decks` | [decks.js:203](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L203) |
| `DELETE` | `/folders/:id/decks/:deckId` | [FolderDetail.jsx:75](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/FolderDetail.jsx#L75) | `DELETE /folders/:id/decks/:deckId` | [decks.js:213](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L213) |
| `POST` | `/folders/:id/members` | [ShareFolderSheet.jsx:34](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/ShareFolderSheet.jsx#L34) | `POST /folders/:id/members` | [decks.js:220](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L220) |
| `DELETE` | `/folders/:id/members/:memberId` | [ShareFolderSheet.jsx:49](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/ShareFolderSheet.jsx#L49) | `DELETE /folders/:id/members/:memberId` | [decks.js:233](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L233) |
| `POST` | `/decks/:id/cards` | [NewCardSheet.jsx:38](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/NewCardSheet.jsx#L38) | `POST /decks/:id/cards` | [decks.js:112](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L112) |
| `POST` | `/decks/:id/export` | [DeckDetail.jsx:106](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/DeckDetail.jsx#L106) | `POST /decks/:id/export` | [decks.js:152](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L152) |
| `POST` | `/publications/:id/appeal` | [DeckDetail.jsx:125](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/DeckDetail.jsx#L125) | `POST /publications/:id/appeal` | [decks.js:135](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L135) |
| `GET` | `/privacy/policy` | [PublishSheet.jsx:26](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/PublishSheet.jsx#L26), [PrivacyPage.jsx:40](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/PrivacyPage.jsx#L40) | `GET /privacy/policy` | [privacy.js:17](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/privacy.js#L17) |
| `POST` | `/decks/:id/publish` | [PublishSheet.jsx:38](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/PublishSheet.jsx#L38) | `POST /decks/:id/publish` | [decks.js:127](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L127) |
| `POST` | `/mcp/simulate` | [McpArrivalAlert.jsx:75](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/mcp/McpArrivalAlert.jsx#L75) | `POST /mcp/simulate` | [mcp.js:125](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/mcp.js#L125) |
| `GET` | `/mcp/inbox` | [arrivals.js:54](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/mcp/arrivals.js#L54) | `GET /mcp/inbox` | [mcp.js:203](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/mcp.js#L203) |
| `POST` | `/mcp/inbox/:id/seen` | [McpArrivalAlert.jsx:92](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/mcp/McpArrivalAlert.jsx#L92) | `POST /mcp/inbox/:id/seen` | [mcp.js:213](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/mcp.js#L213) |
| `GET` | `/mcp/requests` | [arrivals.js:14](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/mcp/arrivals.js#L14) | `GET /mcp/requests` | [mcp.js:153](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/mcp.js#L153) |
| `POST` | `/mcp/requests/:id/approve` | [arrivals.js:43](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/mcp/arrivals.js#L43) | `POST /mcp/requests/:id/approve` | [mcp.js:167](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/mcp.js#L167) |
| `POST` | `/mcp/requests/:id/reject` | [arrivals.js:43](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/mcp/arrivals.js#L43) | `POST /mcp/requests/:id/reject` | [mcp.js:194](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/mcp.js#L194) |
| `GET` | `/noa/overview` | [NoaHub.jsx:26](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/noa/NoaHub.jsx#L26) | `GET /noa/hub` | [noa.js:23](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/noa.js#L23) |
| `POST` | `/noa/decisions/:id/revert` | [NoaHub.jsx:65](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/noa/NoaHub.jsx#L65), [NoaPresence.jsx:35](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/study/NoaPresence.jsx#L35), [PrivacyPage.jsx:65](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/PrivacyPage.jsx#L65) | `POST /noa/decisions/:id/revert` | [noa.js:69](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/noa.js#L69) |
| `PATCH` | `/me/materials/:id` | [BlogEditor.jsx:59](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/BlogEditor.jsx#L59) | `PATCH /me/materials/:id` | [materials.js:163](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js#L163) |
| `POST` | `/me/materials` | [BlogEditor.jsx:70](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/BlogEditor.jsx#L70) | `POST /me/materials` | [materials.js:156](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js#L156) |
| `POST` | `/privacy/reactivate` | [DeactivatedScreen.jsx:25](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/DeactivatedScreen.jsx#L25) | `POST /me/reactivate` | [me.js:63](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/me.js#L63) |
| `GET` | `/me/sessions` | [DevicesPage.jsx:17](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/DevicesPage.jsx#L17) | `GET /me/sessions` | [me.js:33](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/me.js#L33) |
| `DELETE` | `/me/sessions/:id` | [DevicesPage.jsx:24](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/DevicesPage.jsx#L24) | `DELETE /me/sessions/:id` | [me.js:43](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/me.js#L43) |
| `DELETE` | `/me/sessions` | [DevicesPage.jsx:32](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/DevicesPage.jsx#L32) | `DELETE /me/sessions` | [me.js:49](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/me.js#L49) |
| `POST` | `/me/password` | [DevicesPage.jsx:44](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/DevicesPage.jsx#L44) | `POST /me/password` | [me.js:25](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/me.js#L25) |
| `POST` | `/mcp/connections` | [McpConnect.jsx:36](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/McpConnect.jsx#L36) | `POST /mcp/connections` | [mcp.js:18](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/mcp.js#L18) |
| `DELETE` | `/mcp/connections/:id` | [McpConnect.jsx:45](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/McpConnect.jsx#L45) | `DELETE /mcp/connections/:id` | [mcp.js:32](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/mcp.js#L32) |
| `GET` | `/me/materials` | [MyContents.jsx:130](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/MyContents.jsx#L130) | `GET /me/materials` | [materials.js:148](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js#L148) |
| `GET` | `/objectives` | [ObjectivesPage.jsx:22](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/ObjectivesPage.jsx#L22), [GoalMenuSheet.jsx:21](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/study/GoalMenuSheet.jsx#L21) | `GET /objectives` | [study.js:213](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L213) |
| `DELETE` | `/objectives/:id` | [ObjectivesPage.jsx:34](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/ObjectivesPage.jsx#L34) | `DELETE /objectives/:id` | [study.js:238](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L238) |
| `POST` | `/objectives/:id/outcome` | [ObjectivesPage.jsx:46](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/ObjectivesPage.jsx#L46), [SessionDone.jsx:32](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/study/SessionDone.jsx#L32) | `POST /objectives/:id/outcome` | [study.js:246](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L246) |
| `POST` | `/objectives` | [ObjectiveSheet.jsx:35](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/study/ObjectiveSheet.jsx#L35) | `POST /objectives` | [study.js:218](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L218) |
| `PATCH` | `/objectives/:id` | [GoalMenuSheet.jsx:51](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/study/GoalMenuSheet.jsx#L51), [ObjectiveSheet.jsx:54](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/study/ObjectiveSheet.jsx#L54) | `PATCH /objectives/:id` | [study.js:228](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L228) |
| `GET` | `/privacy/decisions` | [PrivacyPage.jsx:32](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/PrivacyPage.jsx#L32), [NoaPresence.jsx:22](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/study/NoaPresence.jsx#L22) | `GET /privacy/decisions` | [privacy.js:10](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/privacy.js#L10) |
| `GET` | `/privacy/export` | [PrivacyPage.jsx:33](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/PrivacyPage.jsx#L33) | `GET /privacy/export` | [privacy.js:27](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/privacy.js#L27) |
| `POST` | `/privacy/export` | [PrivacyPage.jsx:45](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/PrivacyPage.jsx#L45) | `POST /privacy/export` | [privacy.js:33](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/privacy.js#L33) |
| `POST` | `/privacy/delete` | [PrivacyPage.jsx:54](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/PrivacyPage.jsx#L54) | `POST /privacy/delete-account` | [privacy.js:46](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/privacy.js#L46) |
| `POST` | `/privacy/decisions/:id/contest` | [PrivacyPage.jsx:60](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/PrivacyPage.jsx#L60) | `POST /privacy/decisions/:id/contest` | [privacy.js:63](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/privacy.js#L63) |
| `GET` | `/study/mistakes` | [ProfileHome.jsx:23](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/ProfileHome.jsx#L23) | `GET /study/mistakes` | [study.js:52](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L52) |
| `GET` | `/study/history` | [ProfileHome.jsx:24](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/ProfileHome.jsx#L24) | `GET /study/history` | [study.js:39](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js#L39) |
| `GET` | `/subscription` | [SubscriptionPage.jsx:23](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/SubscriptionPage.jsx#L23) | `GET /subscription` | [subscription.js:47](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/subscription.js#L47) |
| `POST` | `/subscription/webhook` | [SubscriptionPage.jsx:32](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/SubscriptionPage.jsx#L32) | `POST /subscription/webhook` | [subscription.js:107](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/subscription.js#L107) |
| `POST` | `/subscription/subscribe` | [SubscriptionPage.jsx:54](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/SubscriptionPage.jsx#L54) | `POST /subscription/upgrade` | [subscription.js:62](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/subscription.js#L62) |
| `POST` | `/subscription/cancel` | [SubscriptionPage.jsx:206](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/SubscriptionPage.jsx#L206) | `POST /subscription/cancel` | [subscription.js:76](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/subscription.js#L76) |
| `POST` | `/subscription/refund` | [SubscriptionPage.jsx:209](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/SubscriptionPage.jsx#L209) | `POST /subscription/refund` | [subscription.js:90](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/subscription.js#L90) |
| `GET` | `/support/tickets` | [SupportPage.jsx:13](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/SupportPage.jsx#L13) | `GET /support/tickets` | [support.js:9](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/support.js#L9) |
| `POST` | `/support/tickets` | [SupportPage.jsx:24](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/SupportPage.jsx#L24) | `POST /support/tickets` | [support.js:15](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/support.js#L15) |
| `POST` | `/support/tickets/:id/messages` | [SupportPage.jsx:41](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/SupportPage.jsx#L41) | `POST /support/tickets/:id/messages` | [support.js:27](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/support.js#L27) |
| `GET` | `/coupons/:id` | [CouponPage.jsx:18](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/wallet/CouponPage.jsx#L18) | `GET /coupons/:id` | [wallet.js:44](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/wallet.js#L44) |
| `POST` | `/coupons/:id/redeem` | [CouponPage.jsx:29](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/wallet/CouponPage.jsx#L29) | `POST /coupons/:id/redeem` | [wallet.js:51](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/wallet.js#L51) |
| `GET` | `/wallet/coupons/:id` | [MyCouponPage.jsx:20](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/wallet/MyCouponPage.jsx#L20) | `GET /wallet/coupons/:id` | [wallet.js:105](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/wallet.js#L105) |
| `GET` | `/coupons` | [WalletPage.jsx:111](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/wallet/WalletPage.jsx#L111) | `GET /coupons` | [wallet.js:33](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/wallet.js#L33) |

---

### 1.3 Rotas Backend Existentes NÃO Usadas Diretamente pelo Aluno (62 rotas)

Estas rotas existem na API Express mas não são chamadas pelo frontend do aluno:

1. **Painel Admin Back-office ([backend/src/routes/admin.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/admin.js)):** 23 rotas
   - `POST /admin/auth/login` (L27), `GET /admin/me` (L36), `GET /admin/moderation/queue` (L40), `GET /admin/moderation/reports` (L48), `GET /admin/moderation/appeals` (L53), `GET /admin/moderation/:id` (L57), `POST /admin/moderation/:id/assign` (L66), `POST /admin/moderation/:id/decide` (L74), `POST /admin/moderation/reports/:id/resolve` (L125), `POST /admin/moderation/appeals/:id/decide` (L138), `GET /admin/support/search` (L157), `POST /admin/support/users/:id/view-as` (L164), `GET /admin/support/tickets` (L186), `POST /admin/support/tickets/:id/reply` (L190), `GET /admin/commercial/overview` (L201), `POST /admin/commercial/partners/:id/approve-stage` (L207), `GET /admin/finance/overview` (L218), `GET /admin/compliance/overview` (L226), `POST /admin/compliance/incidents` (L241), `GET /admin/compliance/incidents/:id/affected` (L252), `POST /admin/compliance/incidents/:id/notify` (L260), `GET /admin/engineering/overview` (L273), `PATCH /admin/engineering/flags/:key` (L290).
2. **Painel B2B / Escolas ([backend/src/routes/b2b.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/b2b.js)):** 7 rotas
   - `POST /b2b/auth/login` (L48), `GET /b2b/overview` (L57), `GET /b2b/classes/:id` (L73), `POST /b2b/invites` (L80), `POST /b2b/students/:id/revoke` (L93), `GET /b2b/export` (L109), `GET /b2b/users` (L123).
3. **Painel Parental ([backend/src/routes/parental.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/parental.js)):** 4 rotas
   - `POST /parental/auth/login` (L14), `GET /parental/overview` (L23), `PATCH /parental/permissions` (L47), `POST /parental/requests/:id/decide` (L69).
4. **Painel Parceiro ([backend/src/routes/partner.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/partner.js)):** 6 rotas
   - `POST /partner/auth/login` (L17), `GET /partner/overview` (L27), `POST /partner/campaigns` (L44), `PATCH /partner/campaigns/:id` (L55), `POST /partner/redemptions/validate` (L65), `POST /partner/contract/accept` (L83).
5. **Comunidade & Moderação ([backend/src/routes/community.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js)):** 3 rotas
   - `GET /community/search` (L71) - *usado via query param, mas mapeado em SearchResults*, `GET /community/rankings` (L387), `GET /community/decks/:id/comments` (L250) - *coberto em comentários unificados*.
6. **Decks & Pastas ([backend/src/routes/decks.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js)):** 3 rotas
   - `POST /decks` (L46) - *front cria decks via geração ou cards diretos*, `DELETE /decks/:id` (L83), `PATCH /folders/:id` (L173).
7. **Geração ([backend/src/routes/generation.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js)):** 1 rota
   - `GET /generation/jobs` (L137) - *front consulta job individual por id*.
8. **Materiais ([backend/src/routes/materials.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js)):** 2 rotas
   - `POST /me/materials` (L156), `GET /community/materials/:id/comments` (L118).
9. **MCP Protocol Server ([backend/src/routes/mcp.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/mcp.js)):** 3 rotas
   - `POST /mcp` (L233), `GET /mcp` (L243), `DELETE /mcp` (L244).
10. **Perfil & Responsáveis ([backend/src/routes/me.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/me.js)):** 3 rotas
    - `GET /me/consents` (L77) - *front lê consents direto no payload de `/me`*, `GET /me/guardian-requests` (L103), `POST /me/guardian-requests` (L107).
11. **Nôa ([backend/src/routes/noa.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/noa.js)):** 1 rota
    - `POST /noa/generate` (L82).
12. **Assinaturas & Carteira ([backend/src/routes/subscription.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/subscription.js), [wallet.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/wallet.js)):** 2 rotas
    - `GET /subscription/invoices` (L120), `GET /wallet/coupons` (L100).
13. **Público / Infra ([backend/src/routes/public.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/public.js), [app.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/app.js)):** 2 rotas
    - `GET /public/content-policy` (L22), `GET /health` (L34).

---

## 2. Leitura e Escrita do `state` por Rota Usada pelo Aluno

O backend mock utiliza um objeto único em memória (`store.state`, gerado em [backend/src/seed/index.js:145](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/seed/index.js#L145)). A seguir, o mapeamento exato de quais fatias de dados são acessadas:

### 2.1 Autenticação e Sessão ([backend/src/routes/auth.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/auth.js))
- **`POST /auth/login` (L10):**
  - **Lê:** `state.users`, `state.consents`.
  - **Escreve:** `state.sessions` (adiciona sessão em [auth.js:16](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/auth.js#L16)), atualiza `user.lastLoginAt`.
- **`POST /auth/register` (L29):**
  - **Lê:** `state.users`.
  - **Escreve:** `state.users` (cria usuário), `state.study[id]`, `state.generation.quota[id]`, `state.notifications[id]`, `state.consents[id]`, `state.noa.budget[id]`, `state.sessions`.
- **`POST /auth/confirm` (L77):**
  - **Lê:** `state.users`.
  - **Escreve:** `user.verified` (`email: true`, `phone: true`), `state.ledger` (concede bônus de confirmação via `appendEntry`).
- **`POST /auth/age-verification` (L102):**
  - **Lê:** `state.users`.
  - **Escreve:** `user.ageVerification`, `user.isMinor`, `user.guardianId`.
- **`POST /auth/onboarding` (L116):**
  - **Lê:** `state.users`, `state.study[id]`.
  - **Escreve:** `user.onboardingDone`, `user.settings`, `state.study[id].goal`.
- **`POST /auth/logout` (L126):**
  - **Lê:** `state.sessions`.
  - **Escreve:** `state.sessions` (remove sessão corrente).

### 2.2 Perfil do Usuário ([backend/src/routes/me.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/me.js))
- **`GET /me` (L14):**
  - **Lê:** `state.users`, `state.study[id]`, `state.ledger` (via `balanceOf`), `state.parental.permissions`.
  - **Escreve:** Nenhuma.
- **`PATCH /me/settings` (L18):**
  - **Lê:** `req.user`.
  - **Escreve:** `user.settings`.
- **`PATCH /me/consents` (L81):**
  - **Lê:** `state.consents[id]`.
  - **Escreve:** `state.consents[id]`.
- **`GET /me/sessions` (L33) & `DELETE /me/sessions/:id` (L43):**
  - **Lê:** `state.sessions`.
  - **Escreve:** `state.sessions` (filtragem).
- **`POST /me/deactivate` (L57) & `POST /me/reactivate` (L63):**
  - **Lê:** `req.user`.
  - **Escreve:** `user.deactivatedAt`.

### 2.3 Estudo e Motor FSRS ([backend/src/routes/study.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js))
- **`GET /study/today` (L27):**
  - **Lê:** `state.study[id]`, `state.cards`, `state.decks`, `state.noa.suggestions`.
  - **Escreve:** Atualiza `dayKey` via `ensureDay` ([helpers.js:53](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/helpers.js#L53)).
- **`POST /reviews` (L63):**
  - **Lê:** `state.cards`, `state.decks`, `state.study[id]`.
  - **Escreve:** `card.sched` (FSRS: estabilidade, dificuldade, repetições, lapses em [fsrs.js:29](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/fsrs.js#L29)), `deck.lastStudiedAt`, `state.study[id]` (`doneToday`, `history`, `streak`, `studyDays`), `state.ledger` (bônus `goal_bonus` se bater a meta diária).
- **`POST /study/fatigue` (L125):**
  - **Lê:** `state.study[id]`.
  - **Escreve:** `state.study[id].fatigue`.
- **`POST /study/complete` (L132):**
  - **Lê:** `state.study[id]`.
  - **Escreve:** `state.study[id]` (marca sessão como concluída), `state.ledger` (bônus de conclusão).
- **`POST /study/skip` (L154), `POST /study/undo-skip` (L166), `POST /study/pause` (L174), `POST /study/resume` (L183):**
  - **Lê:** `state.study[id]`.
  - **Escreve:** `state.study[id].skippedDay`, `state.study[id].pausedUntil`.
- **`PATCH /study/goal` (L192) & `PATCH /study/plan` (L203):**
  - **Lê:** `state.study[id]`.
  - **Escreve:** `state.study[id].goal`, `state.study[id].plan`.
- **`GET /objectives` (L213), `POST /objectives` (L218), `PATCH /objectives/:id` (L228), `DELETE /objectives/:id` (L238):**
  - **Lê:** `state.study[id].objectives`.
  - **Escreve:** `state.study[id].objectives` (CRUD de metas de estudo).
- **`POST /objectives/:id/outcome` (L246):**
  - **Lê:** `state.study[id].objectives`.
  - **Escreve:** `objective.outcome`, `state.ledger` (concede bônus `objective_achieved` via `appendEntry`).

### 2.4 Decks e Pastas ([backend/src/routes/decks.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js))
- **`GET /decks` (L27):**
  - **Lê:** `state.decks`, `state.cards`, `state.folders`, `state.categories`.
  - **Escreve:** Nenhuma.
- **`GET /decks/:id` (L54):**
  - **Lê:** `state.decks`, `state.cards`, `state.folders`, `state.publications`.
  - **Escreve:** Nenhuma.
- **`PATCH /decks/:id` (L71):**
  - **Lê:** `state.decks`.
  - **Escreve:** Propriedades de `deck` (`name`, `difficulty`, `pinned`, `favorite`, `focus`, `difficult`).
- **`POST /decks/:id/cards` (L112), `PATCH /decks/:id/cards/:cardId` (L91), `DELETE /decks/:id/cards/:cardId` (L104):**
  - **Lê:** `state.decks`, `state.cards`.
  - **Escreve:** `state.cards` (criação, alteração ou soft delete com `deletedAt`).
- **`GET /folders` (L166), `POST /folders` (L180), `DELETE /folders/:id` (L192):**
  - **Lê:** `state.folders`.
  - **Escreve:** `state.folders`.
- **`POST /folders/:id/decks` (L203) & `DELETE /folders/:id/decks/:deckId` (L213):**
  - **Lê:** `state.decks`, `state.folders`.
  - **Escreve:** `deck.folderId`.
- **`POST /decks/:id/publish` (L127):**
  - **Lê:** `state.decks`, `state.cards`, `state.consents`, `state.admin.policy`, `state.parental.permissions`.
  - **Escreve:** `state.publications`, `deck.publication`, `state.auditLog`.

### 2.5 Geração de Decks por IA ([backend/src/routes/generation.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js))
- **`GET /generation/quota` (L129):**
  - **Lê:** `state.generation.quota[id]`.
  - **Escreve:** `state.generation.quota[id]` (reinicia no novo dia via `ensureDay`).
- **`POST /generation/jobs` (L142):**
  - **Lê:** `state.generation.quota`, `state.generation.idempotency`.
  - **Escreve:** `state.generation.jobs` (cria job), `state.generation.quota.used`, `state.generation.idempotency`, agenda timers assíncronos via `startTimeline`.
- **`GET /generation/jobs/:id` (L200):**
  - **Lê:** `state.generation.jobs`.
  - **Escreve:** Nenhuma.
- **`POST /generation/jobs/:id/approve` (L253):**
  - **Lê:** `state.generation.jobs`.
  - **Escreve:** `state.decks` (cria deck final), `state.cards` (insere todos os cards gerados), `user.publicProfile.cardsGenerated`, `job.status = 'aprovado'`, `state.auditLog`.

### 2.6 Carteira de Neurônios ([backend/src/routes/wallet.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/wallet.js))
- **`GET /wallet` (L14):**
  - **Lê:** `state.ledger` (filtra lançamentos do usuário e calcula saldo por `balanceOf`), `state.userCoupons`.
  - **Escreve:** Nenhuma.
- **`POST /coupons/:id/redeem` (L51):**
  - **Lê:** `state.coupons`, `state.ledger`.
  - **Escreve:** `coupon.stock`, `state.userCoupons`, `state.ledger` (débito com hash encadeado).

---

## 3. Vulnerabilidades e Quebras em Ambiente Serverless (Vercel)

A arquitetura do backend atual foi concebida sob a [ADR-0001](file:///c:/Users/lusco/OneDrive/Desktop/memora/docs/adr/0001-backend-mock-em-memoria.md) como um processo Node contínuo em memória. Ao ser publicado em ambiente Serverless (Vercel Functions / AWS Lambda), as seguintes quebras estruturais ocorrem:

### 3.1 `setTimeout` e `store.later` Não Executam
- **Onde ocorre:** [backend/src/store.js:14](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/store.js#L14) e [backend/src/routes/generation.js:95](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js#L95).
- **Como quebra:** Na Vercel, assim que o handler HTTP envia a resposta ([generation.js:197](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js#L197) retornando `201`), o runtime congela ou destrói a instância da função. As etapas de pipeline agendadas (`step(600)`, `step(2600)`, `step(6000)` para transição de `na_fila` → `lendo` → `gerando` → `pronto`) **nunca serão disparadas**. O job do aluno fica eternamente travado no status `na_fila`.

### 3.2 Estado Volátil em Memória (`store.state`)
- **Onde ocorre:** [backend/src/store.js:5](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/store.js#L5) e [backend/src/server.js:9](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/server.js#L9).
- **Como quebra:** Cada invocação de Lambda ou reinício de container aloca um novo `createStore('adult-free')`. Dados criados por um aluno (novos decks, cards criados, progresso de revisão) desaparecem na requisição seguinte se atendida por outra instância ou após um cold start.

### 3.3 Sessões e Tokens em Memória
- **Onde ocorre:** [backend/src/lib/auth.js:16](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/auth.js#L16) (`state.sessions.push(session)`) e [backend/src/lib/auth.js:22](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/auth.js#L22) (`findSession`).
- **Como quebra:** O token emitido no login é uma string aleatória em memória (`tok_...`). Como as instâncias serverless não compartilham memória, o middleware `requireStudent` ([auth.js:36](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/auth.js#L36)) não encontra a sessão e rejeita as requisições subsequentes com `401 unauthorized`.

### 3.4 Ledger Imutável e Auditoria em Memória
- **Onde ocorre:** [backend/src/lib/ledger.js:19](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/ledger.js#L19) e [backend/src/lib/audit.js:15](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/audit.js#L15).
- **Como quebra:** A cadeia de hash (`prevHash + sha256`) é calculada sobre o array em memória `state.ledger`. Mutações concorrentes em múltiplas lambdas quebram o encadeamento de hash ou perdem transações financeiras de neurônios.

### 3.5 Servidor MCP / Conexões Longas
- **Onde ocorre:** [backend/src/routes/mcp.js:233-244](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/mcp.js#L233-L244).
- **Como quebra:** Protocolo MCP via HTTP/SSE requer conexão persistente ou streaming contínuo, incompatível com o limite de timeout e encerramento de conexões de serverless padrão da Vercel.

---

## 4. Dependências Escondidas Entre Features

### 4.1 Bloqueios para Publicar na Comunidade ([backend/src/lib/publishing.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/publishing.js))
Ao chamar `POST /decks/:id/publish` ([decks.js:127](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js#L127)), a função `submitDeckPublication` aciona uma cadeia rígida de validações em `publishPreconditions` ([publishing.js:9](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/publishing.js#L9)):
1. **Conta Desativada:** Rejeita se `user.deactivatedAt` estiver preenchido ([publishing.js:10](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/publishing.js#L10)) → `403 account_deactivated`.
2. **Exigência de Verificação Dupla:** `requireVerified(user)` ([helpers.js:190](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/helpers.js#L190)) exige que **tanto e-mail quanto telefone** estejam verificados em `user.verified`. Se faltar um deles → `403 verification_required`.
3. **Controle Parental / Guardian Gate:** `guardianGate(state, user, 'community')` ([helpers.js:183](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/helpers.js#L183)). Se `user.isMinor === true` e a permissão `parental.permissions.community` não estiver ativa, o backend bloqueia a publicação e cria automaticamente um pedido em `state.parental.requests` → `403 guardian_required`.
4. **Aceite de Política de Moderação:** Compara `consents.contentPolicyAcceptedVersion` com `state.admin.policy.version` ([publishing.js:17](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/publishing.js#L17)). Se desatualizado e não receber `acceptPolicy: true` no body → `428 policy_acceptance_required`.
5. **Deck Vazio:** Se `cardsOfDeck` retornar 0 cards → `422 empty_deck` ([publishing.js:36](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/publishing.js#L36)).
6. **Dependência de Back-office para Aprovação:** A publicação é gravada com `status: 'em_triagem'` ([publishing.js:48](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/publishing.js#L48)). Para aparecer publicamente na comunidade, depende de moderação manual executada por um administrador em `POST /admin/moderation/:id/decide` ([admin.js:74](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/admin.js#L74)).

### 4.2 Bloqueios para Criação e Geração de Decks ([backend/src/routes/generation.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js))
Ao chamar `POST /generation/jobs` ([generation.js:142](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js#L142)):
1. **Filtro de PII (Dados Pessoais):** Regex `/\bcpf\b|\bsenha\b|\brg\b\s*\d/i` ([generation.js:153](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js#L153)). Se detectado no texto de entrada → `422 content_filtered`.
2. **Cotas Diárias por Plano:** Limite de 3 decks/dia para plano `free` e 10 decks/dia para `premium` ([helpers.js:7](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/lib/helpers.js#L7)). Ao estourar → `429 daily_limit`.
3. **Orçamento de Leitura:** Se o material exceder 200.000 tokens (`READ_BUDGET_TOKENS` em [generation.js:8](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js#L8)), o job entra no status `acima_do_orcamento` ([generation.js:187](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js#L187)) e exige intervenção do aluno via `POST /generation/jobs/:id/scope` para dividir ou fatiar páginas.
4. **Dependência do `startTimeline`:** O avanço do job depende dos timers em memória do servidor ([generation.js:95](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js#L95)).

---

## 5. Rotas Sem Autenticação ou com Autenticação Fraca

### 5.1 Rotas do Protótipo (`/_proto/*`) — Totalmente Abertas
O arquivo [backend/src/routes/proto.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/proto.js) não implementa nenhum middleware de autenticação (`requireRole` ou `requireStudent`):
- `GET /_proto/state` ([proto.js:25](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/proto.js#L25)): expõe todo o estado interno, dados do usuário `u1` e saldos.
- `POST /_proto/reset` ([proto.js:31](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/proto.js#L31)): **Permite resetar ou apagar todo o banco em memória da aplicação** sem credenciais.
- `POST /_proto/profile` ([proto.js:37](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/proto.js#L37)): troca o perfil ativo livremente.
- `POST /_proto/coupon-available` ([proto.js:45](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/proto.js#L45)): injeta ou subtrai créditos no ledger diretamente.
- `POST /_proto/notification` ([proto.js:58](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/proto.js#L58)): altera contadores de notificação e envia avisos simulados.

### 5.2 Onde a `ProtoBar` Está Montada no Frontend
- **Arquivo e Linha:** [frontend/src/app/App.jsx:178](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/app/App.jsx#L178):
  ```jsx
  <BrowserRouter>
    <AppProviders>
      <AppRoutes />
      <ProtoBar />  {/* Montada globalmente em TODAS as rotas */}
    </AppProviders>
  </BrowserRouter>
  ```
- Além disso, o [frontend/src/state/ProtoContext.jsx:22](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/state/ProtoContext.jsx#L22) dispara automaticamente um `GET /_proto/state` ao carregar a página inicial.

### 5.3 Outras Rotas Sem Autenticação
- `GET /health` ([backend/src/app.js:34](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/app.js#L34)): Aberto (saudável para monitoramento).
- `GET /public/decks/:publicId` ([backend/src/routes/public.js:7](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/public.js#L7)) e `GET /public/content-policy` ([public.js:22](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/public.js#L22)): Abertos intencionalmente para visualização pública.
- `POST /mcp`, `GET /mcp`, `DELETE /mcp` ([backend/src/routes/mcp.js:233](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/mcp.js#L233)): Endpoints do protocolo MCP sem verificação de token.
- `POST /auth/login`, `/register`, `/confirm`, `/resend`, `/age-verification`, `/onboarding`, `/password/recover` ([backend/src/routes/auth.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/auth.js)): Públicos para onboarding inicial.
- **Painéis Admin, Parental, B2B, Parceiro:** Possuem verificações rudimentares de mock (ex.: [admin.js:24](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/admin.js#L24) que aceita tokens arbitrários e não implementa RBAC seguro de produção).

---

## 6. Telas do Aluno e Suas Dependências de API

Mapeamento de todas as telas acessíveis no roteamento do aluno ([frontend/src/app/App.jsx:70-123](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/app/App.jsx#L70-L123)):

| Rota no Frontend | Componente de Página | Arquivo | Chamadas de API Diretas / Indiretas |
|---|---|---|---|
| `/entrar` | `LoginPage` | [LoginPage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/auth/LoginPage.jsx) | `POST /auth/login` (via `SessionContext`) |
| `/criar-conta` | `RegisterPage` | [RegisterPage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/auth/RegisterPage.jsx) | `POST /auth/register` (via `SessionContext`) |
| `/confirmar` | `ConfirmPage` | [ConfirmPage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/auth/ConfirmPage.jsx) | `POST /auth/confirm`, `POST /auth/resend` |
| `/verificar-idade` | `AgeVerificationPage` | [AgeVerificationPage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/auth/AgeVerificationPage.jsx) | `POST /auth/age-verification` |
| `/onboarding` | `OnboardingPage` | [OnboardingPage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/auth/OnboardingPage.jsx) | `POST /auth/onboarding` |
| `/recuperar-senha` | `RecoverPage` | [RecoverPage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/auth/RecoverPage.jsx) | `POST /auth/password/recover` |
| `/d/:publicId` | `PublicDeckPreview` | [PublicDeckPreview.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/public/PublicDeckPreview.jsx) | `GET /public/decks/:publicId` (via `publicApi`) |
| `/app` | `StudyHome` | [StudyHome.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/study/StudyHome.jsx) | `GET /study/today`, `GET /objectives`, `POST /study/skip`, `POST /study/undo-skip`, `POST /study/pause`, `POST /study/resume`, `PATCH /study/goal`, `PATCH /study/plan` |
| `/app/estudar` | `StudySession` | [StudySession.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/study/StudySession.jsx) | `POST /reviews`, `POST /study/fatigue`, `POST /noa/suggestions/:id/respond`, `PATCH /decks/:id` |
| `/app/concluido` | `SessionDone` | [SessionDone.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/study/SessionDone.jsx) | `POST /study/complete`, `POST /objectives/:id/outcome` |
| `/app/criar` | `CreatePage` | [CreatePage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/create/CreatePage.jsx) | `GET /mcp/connections`, `GET /generation/quota`, `POST /generation/jobs`, `POST /generation/jobs/:id/approve` |
| `/app/criar/:jobId` | `GenerationProgress` | [GenerationProgress.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/create/GenerationProgress.jsx) | `GET /generation/jobs/:id`, `POST /generation/jobs/:id/scope`, `POST /generation/jobs/:id/retry`, `POST /generation/jobs/:id/cancel` |
| `/app/criar/:jobId/revisar` | `GenerationReview` | [GenerationReview.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/create/GenerationReview.jsx) | `GET /generation/jobs/:id`, `GET /decks`, `POST /generation/jobs/:id/approve` |
| `/app/decks` | `DecksLibrary` | [DecksLibrary.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/DecksLibrary.jsx) | `GET /decks`, `POST /folders`, `POST /decks/:id/publish`, `GET /privacy/policy` |
| `/app/decks/:deckId` | `DeckDetail` | [DeckDetail.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/DeckDetail.jsx) | `GET /decks/:id`, `PATCH /decks/:id`, `POST /decks/:id/cards`, `PATCH /decks/:id/cards/:cardId`, `DELETE /decks/:id/cards/:cardId`, `POST /decks/:id/export`, `POST /publications/:id/appeal` |
| `/app/pastas/:folderId` | `FolderDetail` | [FolderDetail.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/decks/FolderDetail.jsx) | `GET /folders/:id`, `DELETE /folders/:id`, `POST /folders/:id/decks`, `DELETE /folders/:id/decks/:deckId`, `POST /folders/:id/members`, `DELETE /folders/:id/members/:memberId` |
| `/app/comunidade` | `CommunityHome` | [CommunityHome.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommunityHome.jsx) | `GET /community/feed`, `GET /community/groups` |
| `/app/comunidade/busca` | `SearchResults` | [SearchResults.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/SearchResults.jsx) | `GET /community/search` |
| `/app/comunidade/grupos` | `GroupsPage` | [Groups.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Groups.jsx) | `GET /community/groups`, `POST /community/groups/:id/join` |
| `/app/comunidade/grupos/:groupId` | `GroupDetail` | [Groups.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/Groups.jsx) | `GET /community/groups/:id`, `POST /community/groups/:id/posts`, `POST /community/group-posts/:id/like` |
| `/app/comunidade/deck/:deckId` | `CommunityDeck` | [CommunityDeck.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/CommunityDeck.jsx) | `GET /community/decks/:id`, `POST /community/decks/:id/favorite`, `POST /community/decks/:id/clone`, `POST /community/decks/:id/vote`, `POST /community/decks/:id/react`, `POST /community/decks/:id/share`, `POST /community/decks/:id/report`, `POST /community/decks/:id/translate`, `POST /community/decks/:id/study-start`, `POST /community/authors/:id/follow` |
| `/app/comunidade/autor/:authorId` | `AuthorProfile` | [AuthorProfile.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/AuthorProfile.jsx) | `GET /community/authors/:id`, `POST /community/authors/:id/follow` |
| `/app/comunidade/conteudo/:materialId` | `MaterialView` | [MaterialView.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/community/MaterialView.jsx) | `GET /community/materials/:id`, `POST /community/materials/:id/favorite`, `POST /community/materials/:id/react`, `POST /community/materials/:id/report`, `POST /community/materials/:id/quiz-attempts`, `POST /community/materials/:id/quiz-review` |
| `/app/perfil/conexoes` | `McpConnect` | [McpConnect.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/McpConnect.jsx) | `GET /mcp/connections`, `POST /mcp/connections`, `DELETE /mcp/connections/:id` |
| `/app/perfil/blog/novo` / `blog/:postId` | `BlogEditor` | [BlogEditor.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/BlogEditor.jsx) | `GET /community/materials/:id`, `POST /me/materials`, `PATCH /me/materials/:id` |
| `/app/noa` | `NoaHub` | [NoaHub.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/noa/NoaHub.jsx) | `GET /noa/hub`, `GET /mcp/connections`, `POST /noa/suggestions/:id/respond`, `POST /noa/decisions/:id/revert` |
| `/app/recebidos` | `McpRequests` | [McpRequests.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/mcp/McpRequests.jsx) | `GET /mcp/requests`, `POST /mcp/requests/:id/approve`, `POST /mcp/requests/:id/reject` |
| `/app/perfil` | `ProfileHome` | [ProfileHome.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/ProfileHome.jsx) | `GET /decks`, `GET /wallet`, `GET /study/mistakes`, `GET /study/history` |
| `/app/perfil/assinatura` | `SubscriptionPage` | [SubscriptionPage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/SubscriptionPage.jsx) | `GET /subscription`, `POST /subscription/upgrade`, `POST /subscription/cancel`, `POST /subscription/refund`, `POST /subscription/webhook` |
| `/app/perfil/privacidade` | `PrivacyPage` | [PrivacyPage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/PrivacyPage.jsx) | `GET /privacy/decisions`, `GET /privacy/policy`, `GET /privacy/export`, `POST /privacy/export`, `POST /privacy/delete-account`, `POST /privacy/decisions/:id/contest`, `POST /noa/decisions/:id/revert` |
| `/app/perfil/dispositivos` | `DevicesPage` | [DevicesPage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/DevicesPage.jsx) | `GET /me/sessions`, `DELETE /me/sessions/:id`, `DELETE /me/sessions`, `POST /me/password` |
| `/app/perfil/configuracoes` | `SettingsPage` | [SettingsPage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/SettingsPage.jsx) | `PATCH /me/settings`, `PATCH /me/consents` |
| `/app/perfil/objetivos` | `ObjectivesPage` | [ObjectivesPage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/ObjectivesPage.jsx) | `GET /objectives`, `POST /objectives`, `PATCH /objectives/:id`, `DELETE /objectives/:id`, `POST /objectives/:id/outcome` |
| `/app/perfil/suporte` | `SupportPage` | [SupportPage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/profile/SupportPage.jsx) | `GET /support/tickets`, `POST /support/tickets`, `POST /support/tickets/:id/messages` |
| `/app/carteira` | `WalletPage` | [WalletPage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/wallet/WalletPage.jsx) | `GET /wallet`, `GET /coupons` |
| `/app/carteira/cupom/:couponId` | `CouponPage` | [CouponPage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/wallet/CouponPage.jsx) | `GET /coupons/:id`, `POST /coupons/:id/redeem` |
| `/app/carteira/meus/:myCouponId` | `MyCouponPage` | [MyCouponPage.jsx](file:///c:/Users/lusco/OneDrive/Desktop/memora/frontend/src/features/wallet/MyCouponPage.jsx) | `GET /wallet/coupons/:id` |

*(Wrappers globais ativos em todas as rotas do aluno: `StudentLayout` carrega `LayoutBanners` com `GET /generation/jobs/:id` e barra inferior com saldo de `GET /wallet`).*

---

## 7. Contagem de Rotas por Área e Proposta de Classificação

Seguindo as **Regras Fixas de `AGENTS.md` (Regra 10: fora do MVP: painéis parental/B2B/back-office/parceiro, MCP e Recebidos, materiais, grupos, ranking, assinatura, cupons)** somadas à instrução explícita **"mais Neurônios (apenas ganho) e objetivos de estudo, que ENTRAM"**:

### 7.1 Resumo Numérico
| Ação Proposta | Quantidade de Rotas Backend | % do Backend |
|---|---|---|
| **MIGRAR** (Banco real + lógica de negócio de produção) | **56** | 30.8% |
| **DESLIGAR** (Desativar rota no `app.js` e ocultar tela por flag) | **113** | 62.1% |
| **MANTER MOCKADO** (Manter sem banco real para não bloquear UX) | **13** | 7.1% |
| **TOTAL** | **182** | 100% |

---

### 7.2 Detalhamento por Área

| Área / Domínio | Total de Rotas | MIGRAR | DESLIGAR | MANTER MOCKADO | Justificativa / Decisão |
|---|---|---|---|---|---|
| **`auth`** ([routes/auth.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/auth.js)) | 8 | **8** | 0 | 0 | **MIGRAR**: Login, cadastro, confirmação, verificação de idade (adultos), onboarding, logout e recuperação de senha. |
| **`me`** ([routes/me.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/me.js)) | 10 | **8** | **2** | 0 | **MIGRAR** 8: Perfil `/me`, configurações, consentimentos, sessões, desativação/reativação. **DESLIGAR** 2: `/me/guardian-requests` (parental fora) e `/me/publications`. |
| **`study`** ([routes/study.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/study.js)) | 17 | **17** | 0 | 0 | **MIGRAR** 17: Loop central FSRS (`/study/today`, `/reviews`, fadiga, conclusão, skip/pause/resume, metas diárias) e **Objetivos de Estudo** (`/objectives`, `/objectives/:id/outcome`). |
| **`decks`** ([routes/decks.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/decks.js)) | 15 | **11** | **4** | 0 | **MIGRAR** 11: Biblioteca de decks, detalhes, edição de decks e cards, pastas. **DESLIGAR** 4: Publicação na comunidade (`/publish`, `/unpublish`, `/appeal`) e membros em pastas (`/folders/:id/members`). |
| **`generation`** ([routes/generation.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/generation.js)) | 8 | **8** | 0 | 0 | **MIGRAR** 8: Criação de decks (câmera, arquivo, texto, anki, vazio), aprovação e controle de cotas. *(Necessário adaptar o pipeline assíncrono para serverless)*. |
| **`wallet`** ([routes/wallet.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/wallet.js)) | 6 | **1** | **5** | 0 | **MIGRAR** 1: `GET /wallet` (saldo e extrato de ganhos de Neurônios). **DESLIGAR** 5: `/coupons` e resgate (`/coupons/:id/redeem`), conforme Regra 10. |
| **`privacy`** ([routes/privacy.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/privacy.js)) | 7 | **1** | 0 | **6** | **MIGRAR** 1: Política de privacidade. **MANTER MOCKADO** 6: Exportação e contestações LGPD complexas não essenciais para 5 testadores. |
| **`noa`** ([routes/noa.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/noa.js)) | 4 | 0 | 0 | **4** | **MANTER MOCKADO** 4: Sugestões contextuais e catálogo da assistente (sem LLM ativo em tempo real). |
| **`support`** ([routes/support.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/support.js)) | 3 | 0 | 0 | **3** | **MANTER MOCKADO** 3: Tickets de suporte (não há equipe de atendimento/back-office ativa). |
| **`public`** ([routes/public.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/public.js)) & **`health`** | 3 | **2** | **1** | 0 | **MIGRAR** 2: `/health` e `/public/content-policy`. **DESLIGAR** 1: `/public/decks/:publicId`. |
| **`community`** ([routes/community.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/community.js)) | 23 | 0 | **23** | 0 | **DESLIGAR** 23: Grupos de estudo, rankings, feed comunitário, votos, reações e comentários (Regra 10). |
| **`materials`** ([routes/materials.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/materials.js)) | 15 | 0 | **15** | 0 | **DESLIGAR** 15: Quiz, linha do tempo, mapa mental e posts de blog (Regra 10). |
| **`mcp`** ([routes/mcp.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/mcp.js)) | 12 | 0 | **12** | 0 | **DESLIGAR** 12: MCP e tela de Recebidos (Regra 10). |
| **`subscription`** ([routes/subscription.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/subscription.js)) | 6 | 0 | **6** | 0 | **DESLIGAR** 6: Planos e cobrança (todos os testadores estarão liberados) (Regra 10). |
| **`admin`** ([routes/admin.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/admin.js)) | 23 | 0 | **23** | 0 | **DESLIGAR** 23: Painel de moderação e back-office (Regra 10). |
| **`parental`** ([routes/parental.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/parental.js)) | 4 | 0 | **4** | 0 | **DESLIGAR** 4: Painel parental (todos os testadores são adultos) (Regra 10). |
| **`b2b`** ([routes/b2b.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/b2b.js)) | 7 | 0 | **7** | 0 | **DESLIGAR** 7: Painel escola / B2B (Regra 10). |
| **`partner`** ([routes/partner.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/partner.js)) | 6 | 0 | **6** | 0 | **DESLIGAR** 6: Painel parceiro de cupons (Regra 10). |
| **`proto`** ([routes/proto.js](file:///c:/Users/lusco/OneDrive/Desktop/memora/backend/src/routes/proto.js)) | 5 | 0 | **5** | 0 | **DESLIGAR** 5: Rotas de debug do protótipo e remoção da `ProtoBar` da UI. |
| **TOTAL** | **182** | **56** | **113** | **13** | |

---

## 8. Riscos e Dúvidas que Precisam de Resposta

Para manter conformidade com a **Regra 1 ("Não deduza nada. Em caso de dúvida, pergunte antes de agir")** e **Regra 2 ("Aprovação prévia de PLANO")**, listo abaixo as decisões críticas necessárias:

### 8.1 Dúvidas de Infraestrutura e Banco
1. **Em qual branch devo trabalhar?**
   - *Fato constatado:* O repositório está na branch `main` (commit `d21c7b9`). A regra diz: *"Trabalhe SOMENTE na branch indicada por mim."* Qual o nome exato da branch de trabalho que devo criar ou usar?
2. **Qual é o banco de dados e estratégia de Auth definidos para o MVP?**
   - A regra 4 menciona *"Nunca use a service_role do Supabase no frontend"*. Isso confirma que usaremos Supabase (PostgreSQL)?
   - Usaremos o **Supabase Auth** nativo diretamente, ou manteremos o Express emitindo JWT próprio conectado ao banco PostgreSQL do Supabase?
   - Qual ORM/query builder deve ser adotado no backend Express (ex.: Prisma, Kysely, ou driver `pg`/`@supabase/supabase-js`)?

### 8.2 Dúvidas sobre Geração de Decks (IA) vs Serverless
3. **Como deve ser tratada a geração de decks no MVP?**
   - O código atual usa `store.later` (timers simulados) que morrem na Vercel.
   - Para os ~5 testadores adultos:
     - **Opção A:** Geração real síncrona via chamada direta a API (Gemini / Claude) dentro do tempo limite da requisição (ex.: 10-15s na Vercel)?
     - **Opção B:** Geração real assíncrona gravada no banco com polling regular (`GET /generation/jobs/:id`)?
     - **Opção C:** Manter mock síncrono imediato gerando cards dos samples sem depender de `store.later`?

### 8.3 Dúvidas de Escopo e Navegação
4. **Desativação visual no Frontend (Regra 5):**
   - Conforme regra 5 (*"tire a tela da navegação por flag de configuração"*), podemos criar um arquivo `frontend/src/config/features.js` com flags booleanas (ex.: `COMMUNITY: false`, `MCP: false`, `MATERIALS: false`, `COUPONS: false`, `PROTO_BAR: false`) para ocultar itens de menu, rotas e a barra de protótipo sem apagar arquivos de código?
5. **Neurônios (apenas ganho):**
   - Confirmado: o aluno ganha neurônios por bater meta diária de estudos (`goal_bonus`) e completar metas (`objectives`).
   - A tela `/app/carteira` exibirá apenas o saldo e o histórico de ganhos, desativando a listagem de cupons e o botão de resgate?

---
*Relatório concluído e gravado em `docs/mvp/01-reconhecimento.md`.*

