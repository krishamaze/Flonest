import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, CardContent } from '../components/ui/Card'
import { Button } from '../components/ui/Button'

export function JoinOrgPage() {
  const [inviteCode, setInviteCode] = useState('')
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const navigate = useNavigate()

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setInfoMessage(
      'Invite-based onboarding is coming soon. Please ask the owner to send you an invite email.'
    )
    setInviteCode('')
  }

  return (
    <div className="safe-top safe-bottom px-md py-lg">
      <div className="max-w-2xl mx-auto space-y-lg">
        <div>
          <h1 className="text-3xl font-bold text-primary-text">Join an existing organization</h1>
          <p className="mt-sm text-secondary-text">
            Ask the owner or admin of the organization to send you an invite. Once you receive an
            invite link or join code, enter it below.
          </p>
        </div>

        <Card className="shadow-md">
          <CardContent className="space-y-md">
            <form className="space-y-md" onSubmit={handleSubmit}>
              <label className="block text-sm font-medium text-primary-text">
                Join code or invite link
                <input
                  type="text"
                  value={inviteCode}
                  onChange={(e) => setInviteCode(e.target.value)}
                  placeholder="paste the invite link or code"
                  className="mt-xs w-full rounded-md border border-neutral-300 bg-white px-md py-sm text-primary-text focus:border-primary focus:ring-primary"
                />
              </label>
              <Button type="submit" variant="primary" disabled>
                Coming soon
              </Button>
            </form>
            {infoMessage && <p className="text-sm text-secondary-text">{infoMessage}</p>}
            <div className="text-sm text-secondary-text">
              Need to switch back to your own business? Use the org switcher at the top of the app or{' '}
              <button
                type="button"
                className="text-primary underline-offset-2 hover:underline"
                onClick={() => navigate('/')}
              >
                return to the dashboard
              </button>
              .
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
