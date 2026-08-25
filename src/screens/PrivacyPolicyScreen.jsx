import LegalScreen from '../components/LegalScreen'

export default function PrivacyPolicyScreen({ onBack }) {
  return <LegalScreen titleKey="privacy.title" bodyKey="privacy.body" onBack={onBack} />
}
