import { Suspense, lazy } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ToastProvider } from '../design-system/index.js'
import { ProtoProvider } from '../state/ProtoContext.jsx'
import { SessionProvider, useSession } from '../state/SessionContext.jsx'
import { StudyProvider } from '../state/StudyContext.jsx'
import { AuthLayout } from '../features/auth/AuthLayout.jsx'
import { LoginPage } from '../features/auth/LoginPage.jsx'
import { RegisterPage } from '../features/auth/RegisterPage.jsx'
import { ConfirmPage } from '../features/auth/ConfirmPage.jsx'
import { AgeVerificationPage } from '../features/auth/AgeVerificationPage.jsx'
import { OnboardingPage } from '../features/auth/OnboardingPage.jsx'
import { RecoverPage } from '../features/auth/RecoverPage.jsx'
import { StudentLayout } from '../areas/student/StudentLayout.jsx'
import { StudyHome } from '../features/study/StudyHome.jsx'
import { StudySession } from '../features/study/StudySession.jsx'
import { SessionDone } from '../features/study/SessionDone.jsx'
import { CreatePage } from '../features/create/CreatePage.jsx'
import { GenerationProgress } from '../features/create/GenerationProgress.jsx'
import { GenerationReview } from '../features/create/GenerationReview.jsx'
import { DecksLibrary } from '../features/decks/DecksLibrary.jsx'
import { DeckDetail } from '../features/decks/DeckDetail.jsx'
import { FolderDetail } from '../features/decks/FolderDetail.jsx'
import { CommunityHome } from '../features/community/CommunityHome.jsx'
import { SearchResults } from '../features/community/SearchResults.jsx'
import { CommunityDeck } from '../features/community/CommunityDeck.jsx'
import { AuthorProfile } from '../features/community/AuthorProfile.jsx'
import { ProfileHome } from '../features/profile/ProfileHome.jsx'
import { SubscriptionPage } from '../features/profile/SubscriptionPage.jsx'
import { PrivacyPage } from '../features/profile/PrivacyPage.jsx'
import { DevicesPage } from '../features/profile/DevicesPage.jsx'
import { SettingsPage } from '../features/profile/SettingsPage.jsx'
import { ObjectivesPage } from '../features/profile/ObjectivesPage.jsx'
import { SupportPage } from '../features/profile/SupportPage.jsx'
import { WalletPage } from '../features/wallet/WalletPage.jsx'
import { CouponPage } from '../features/wallet/CouponPage.jsx'
import { MyCouponPage } from '../features/wallet/MyCouponPage.jsx'
import { PublicDeckPreview } from '../features/public/PublicDeckPreview.jsx'
import { NotFoundPage } from '../features/public/NotFoundPage.jsx'
import { ProtoBar } from '../features/proto/ProtoBar.jsx'
import { Splash } from './Splash.jsx'

const ParentalArea = lazy(() => import('../areas/parental/ParentalArea.jsx').then((m) => ({ default: m.ParentalArea })))
const PartnerArea = lazy(() => import('../areas/partner/PartnerArea.jsx').then((m) => ({ default: m.PartnerArea })))
const B2BArea = lazy(() => import('../areas/b2b/B2BArea.jsx').then((m) => ({ default: m.B2BArea })))
const AdminArea = lazy(() => import('../areas/admin/AdminArea.jsx').then((m) => ({ default: m.AdminArea })))
import { DeactivatedScreen } from '../features/profile/DeactivatedScreen.jsx'

function RootRedirect() {
  const session = useSession()
  if (session.status === 'loading') return <Splash />
  return <Navigate to={session.isAuthed ? '/app' : '/entrar'} replace />
}

function RequireStudent({ children }) {
  const session = useSession()
  const location = useLocation()
  if (session.status === 'loading') return <Splash />
  if (!session.isAuthed) return <Navigate to={`/entrar?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (session.user?.deactivatedAt) return <DeactivatedScreen />
  return children
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route element={<AuthLayout />}>
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="/criar-conta" element={<RegisterPage />} />
        <Route path="/confirmar" element={<ConfirmPage />} />
        <Route path="/verificar-idade" element={<AgeVerificationPage />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/recuperar-senha" element={<RecoverPage />} />
      </Route>
      <Route path="/d/:publicId" element={<PublicDeckPreview />} />
      <Route
        path="/app"
        element={
          <RequireStudent>
            <StudentLayout />
          </RequireStudent>
        }
      >
        <Route index element={<StudyHome />} />
        <Route path="estudar" element={<StudySession />} />
        <Route path="concluido" element={<SessionDone />} />
        <Route path="criar" element={<CreatePage />} />
        <Route path="criar/:jobId" element={<GenerationProgress />} />
        <Route path="criar/:jobId/revisar" element={<GenerationReview />} />
        <Route path="decks" element={<DecksLibrary />} />
        <Route path="decks/:deckId" element={<DeckDetail />} />
        <Route path="pastas/:folderId" element={<FolderDetail />} />
        <Route path="comunidade" element={<CommunityHome />} />
        <Route path="comunidade/busca" element={<SearchResults />} />
        <Route path="comunidade/deck/:deckId" element={<CommunityDeck />} />
        <Route path="comunidade/autor/:authorId" element={<AuthorProfile />} />
        <Route path="perfil" element={<ProfileHome />} />
        <Route path="perfil/assinatura" element={<SubscriptionPage />} />
        <Route path="perfil/privacidade" element={<PrivacyPage />} />
        <Route path="perfil/dispositivos" element={<DevicesPage />} />
        <Route path="perfil/configuracoes" element={<SettingsPage />} />
        <Route path="perfil/objetivos" element={<ObjectivesPage />} />
        <Route path="perfil/suporte" element={<SupportPage />} />
        <Route path="carteira" element={<WalletPage />} />
        <Route path="carteira/cupom/:couponId" element={<CouponPage />} />
        <Route path="carteira/meus/:myCouponId" element={<MyCouponPage />} />
      </Route>
      <Route
        path="/parental/*"
        element={
          <Suspense fallback={<Splash />}>
            <ParentalArea />
          </Suspense>
        }
      />
      <Route
        path="/parceiro/*"
        element={
          <Suspense fallback={<Splash />}>
            <PartnerArea />
          </Suspense>
        }
      />
      <Route
        path="/b2b/*"
        element={
          <Suspense fallback={<Splash />}>
            <B2BArea />
          </Suspense>
        }
      />
      <Route
        path="/admin/*"
        element={
          <Suspense fallback={<Splash />}>
            <AdminArea />
          </Suspense>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export function AppProviders({ children }) {
  return (
    <ToastProvider>
      <ProtoProvider>
        <SessionProvider>
          <StudyProvider>{children}</StudyProvider>
        </SessionProvider>
      </ProtoProvider>
    </ToastProvider>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRoutes />
        <ProtoBar />
      </AppProviders>
    </BrowserRouter>
  )
}
