import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { SparklesIcon, XMarkIcon } from '@heroicons/react/24/outline';

/**
 * WelcomeOfferPanel – A persistent announcement banner for offers and updates.
 * Currently displays the 90-day trial offer.
 *
 * Props:
 *  - tenantName?: string – organization name.
 *  - onUpgrade: () => void – callback when banner is clicked.
 */
export function WelcomeOfferPanel({
    tenantName,
    onUpgrade,
}: {
    tenantName?: string;
    onUpgrade: () => void;
}) {
    const [visible, setVisible] = useState(false);

    // Check if previously dismissed
    useEffect(() => {
        const dismissed = localStorage.getItem('welcome_offer_dismissed');
        if (!dismissed) {
            setVisible(true);
        }
    }, []);

    const handleClose = (e: React.MouseEvent) => {
        e.stopPropagation();
        setVisible(false);
        localStorage.setItem('welcome_offer_dismissed', 'true');
    };

    const handleClick = () => {
        // Optional: decide if clicking the banner should dismiss it or keep it.
        // Usually clicking a CTA might dismiss it or leave it until action is complete.
        // For now, we'll keep it visible or let the user dismiss it manually, 
        // but the previous behavior dismissed it on click.
        // Let's keep it persistent unless explicitly closed, or dismiss on action?
        // User said "persistent announcement area". 
        // If I click "Upgrade", I go to a new page. When I come back, should it be there?
        // If I upgraded, it shouldn't be there (logic in parent handles that hopefully).
        // If I didn't upgrade, it should probably still be there.
        // So let's NOT dismiss on click, just execute action.
        onUpgrade();
    };

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                    animate={{ opacity: 1, height: 'auto', marginBottom: '1rem' }}
                    exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-bg-card shadow-md rounded-md flex items-center justify-between p-sm cursor-pointer overflow-hidden"
                    onClick={handleClick}
                    style={{
                        backgroundColor: 'var(--bg-card)',
                        boxShadow: 'var(--shadow-md)',
                    }}
                >
                    <div className="flex items-center gap-sm">
                        <SparklesIcon className="h-5 w-5 text-primary" aria-hidden="true" />
                        <span className="text-sm font-medium text-primary-text">
                            {tenantName ? `${tenantName} – ` : ''}90‑Day Trial – Upgrade & Unlock All Features
                        </span>
                    </div>
                    <button
                        type="button"
                        aria-label="Dismiss offer"
                        onClick={handleClose}
                        className="p-1 rounded-full hover:bg-muted-bg focus:outline-none"
                    >
                        <XMarkIcon className="h-4 w-4 text-muted-text" />
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
