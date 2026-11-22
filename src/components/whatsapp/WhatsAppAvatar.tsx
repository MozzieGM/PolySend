import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { initials } from '../../lib/format';

interface WhatsAppAvatarProps {
  name: string;
  color: string;
  isGroup?: boolean;
  size?: number;
  online?: boolean;
  imageUrl?: string | null;
}

export function WhatsAppAvatar({
  name,
  color,
  isGroup = false,
  size = 42,
  online = false,
  imageUrl = null,
}: WhatsAppAvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [imageUrl]);

  return (
    <span
      className={`wa-avatar ${isGroup ? 'is-group' : ''} ${imageUrl && !failed ? 'has-image' : ''}`}
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
      {imageUrl && !failed ? (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : isGroup ? (
        <Users size={Math.round(size * 0.42)} strokeWidth={2} />
      ) : (
        initials(name)
      )}
      {online && <span className="wa-avatar-online" />}
    </span>
  );
}
