import { Users } from 'lucide-react';
import { initials } from '../../lib/format';

interface WhatsAppAvatarProps {
  name: string;
  color: string;
  isGroup?: boolean;
  size?: number;
  online?: boolean;
}

export function WhatsAppAvatar({
  name,
  color,
  isGroup = false,
  size = 42,
  online = false,
}: WhatsAppAvatarProps) {
  return (
    <span
      className={`wa-avatar ${isGroup ? 'is-group' : ''}`}
      style={{
        width: size,
        height: size,
        background: `${color}1f`,
        borderColor: `${color}3d`,
        color,
        fontSize: Math.max(10, Math.round(size * 0.32)),
      }}
      aria-hidden="true"
    >
      {isGroup ? <Users size={Math.round(size * 0.42)} strokeWidth={2} /> : initials(name)}
      {online && <span className="wa-avatar-online" />}
    </span>
  );
}
