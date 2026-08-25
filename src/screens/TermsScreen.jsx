import LegalScreen from '../components/LegalScreen'

export default function TermsScreen({ onBack }) {
  return <LegalScreen titleKey="terms.title" bodyKey="terms.body" onBack={onBack} />
}
