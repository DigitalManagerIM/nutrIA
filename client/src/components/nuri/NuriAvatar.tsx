import { motion } from 'framer-motion';

export type NuriState =
  | 'normal'
  | 'chef'
  | 'fitness'
  | 'scientist'
  | 'celebrating'
  | 'thinking'
  | 'worried'
  | 'angry'
  | 'success'
  | 'chat';

interface Props {
  state?: NuriState;
  size?: number;
  animate?: boolean;
  className?: string;
}

// PNG illustrations — map each state to the correct character image
const stateMap: Record<NuriState, string> = {
  normal:      '/nuri/nutria%20personaje%20principal.png',
  thinking:    '/nuri/nutria%20personaje%20principal.png',
  fitness:     '/nuri/nutria%20personaje%20principal.png',
  chef:        '/nuri/nutria%20para%20comidas.png',
  scientist:   '/nuri/nutria%20para%20anliticas.png',
  celebrating: '/nuri/nutria%20buen%20trabajo.png',
  success:     '/nuri/nutria%20buen%20trabajo.png',
  worried:     '/nuri/nutria%20enfadada.png',
  angry:       '/nuri/nutria%20enfadada.png',
  chat:        '/nuri/nutria%20para%20chat.png',
};

export default function NuriAvatar({ state = 'normal', size = 80, animate = true, className = '' }: Props) {
  const bounceAnim = state === 'celebrating' || state === 'success'
    ? { y: [0, -14, 0], transition: { repeat: Infinity, duration: 0.6 } }
    : state === 'thinking'
    ? { rotate: [0, 3, -3, 0], transition: { repeat: Infinity, duration: 2 } }
    : animate
    ? { y: [0, -5, 0], transition: { repeat: Infinity, duration: 2.2, ease: 'easeInOut' } }
    : {};

  return (
    <motion.img
      src={stateMap[state]}
      alt={`NutrIA ${state}`}
      width={size}
      height={size}
      animate={bounceAnim}
      className={`select-none object-contain ${className}`}
      draggable={false}
    />
  );
}
