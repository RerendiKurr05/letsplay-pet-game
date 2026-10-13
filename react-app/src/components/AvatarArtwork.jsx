import { getGameAsset } from '../assets';

const DEFAULT_PARTS = {
  body: 'cream',
  outfit: 'berry',
  eyes: 'round',
  hair: 'tuft',
  accessory: 'none',
};

export default function AvatarArtwork({ mood = 'neutral', parts = {} }) {
  const avatar = { ...DEFAULT_PARTS, ...parts };
  const layerAsset = (layer) => getGameAsset('avatarLayers', layer, avatar[layer]);
  const bodyAsset = layerAsset('body');
  const outfitAsset = layerAsset('outfit');
  const eyesAsset = layerAsset('eyes');
  const hairAsset = layerAsset('hair');
  const accessoryAsset = layerAsset('accessory');

  return (
    <div className={`petgame-artwork petgame-avatar-artwork petgame-artwork-${mood}`}>
      <svg viewBox="0 0 180 180" role="img" aria-label={`${mood} layered player avatar`}>
        <ellipse className="petgame-artwork-shadow" cx="90" cy="158" rx="47" ry="8" />
        {bodyAsset ? (
          <image href={bodyAsset} x="0" y="0" width="180" height="180" preserveAspectRatio="xMidYMid meet" />
        ) : (
          <g className={`petgame-avatar-layer petgame-avatar-body body-${avatar.body}`}>
            <path className="petgame-avatar-torso" d="M39 156q2-31 18-39l18-9h30l18 9q16 8 18 39q-51 19-102 0Z" />
            <path className="petgame-avatar-neck" d="M78 91h24v29q-12 10-24 0V91Z" />
            <ellipse className="petgame-avatar-ear" cx="57" cy="74" rx="8" ry="12" />
            <ellipse className="petgame-avatar-ear" cx="123" cy="74" rx="8" ry="12" />
            <path className="petgame-avatar-head" d="M59 69q0-33 31-33t31 33v14q0 27-31 31T59 83V69Z" />
            <path className="petgame-avatar-face-light" d="M66 67q3-22 24-24-17 8-16 27v17q0 12 8 20-17-7-17-25V67Z" />
          </g>
        )}

        <g className={`petgame-avatar-layer petgame-avatar-outfit outfit-${avatar.outfit}`}>
          {outfitAsset ? (
            <image href={outfitAsset} x="0" y="0" width="180" height="180" preserveAspectRatio="xMidYMid meet" />
          ) : (
            <>
              <path className="petgame-avatar-shirt" d="M70 108l-19 9q-11 5-14 18l-6 22q59 20 118 0l-6-22q-3-13-14-18l-19-9q-10 13-20 13t-20-13Z" />
              <path className="petgame-avatar-collar" d="m70 108 20 15 20-15-7-5q-13 7-26 0l-7 5Z" />
              <path className="petgame-avatar-shirt-detail" d="M90 124v25m-8-21 8 7 8-7" />
            </>
          )}
        </g>

        {eyesAsset ? (
          <image href={eyesAsset} x="0" y="0" width="180" height="180" preserveAspectRatio="xMidYMid meet" />
        ) : (
          <g className="petgame-avatar-eyes">
            {avatar.eyes === 'sleepy' ? (
              <path d="M68 75q8-7 17 0m10 0q9-7 17 0" />
            ) : avatar.eyes === 'starry' ? (
              <path d="m76 68 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Zm28 0 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z" />
            ) : (
              <>
                <ellipse cx="77" cy="76" rx="4.5" ry="6" />
                <ellipse cx="103" cy="76" rx="4.5" ry="6" />
                <circle className="petgame-avatar-eye-glint" cx="78.5" cy="74" r="1.5" />
                <circle className="petgame-avatar-eye-glint" cx="104.5" cy="74" r="1.5" />
              </>
            )}
          </g>
        )}

        {!eyesAsset && avatar.eyes !== 'sleepy' && avatar.eyes !== 'starry' && (
          <path className="petgame-avatar-brows" d={mood === 'sad' ? 'm69 66 11 3m14-3 11-3' : 'm69 66 11-2m14 0 11 2'} />
        )}
        {!bodyAsset && (
          <g className="petgame-avatar-cheeks">
            <ellipse cx="66" cy="88" rx="7" ry="3.5" />
            <ellipse cx="114" cy="88" rx="7" ry="3.5" />
          </g>
        )}

        <g className="petgame-avatar-mouth">
          <path d="M83 92q7 9 14 0" />
        </g>

        {hairAsset ? (
          <image href={hairAsset} x="0" y="0" width="180" height="180" preserveAspectRatio="xMidYMid meet" />
        ) : avatar.hair !== 'none' && (
          <g className={`petgame-avatar-layer petgame-avatar-hair hair-${avatar.hair}`}>
            {avatar.hair === 'tuft' && <path d="M57 70q-6-24 10-35 1 10 8 15 7-22 22-23 2 15 14 21l9-10q12 14 3 31-17-2-28-15-12 16-38 16Z" />}
            {avatar.hair === 'fringe' && <path d="M57 71q-6-25 13-37 6 12 18 14 9-15 25-11 14 13 8 34-13-4-24-19-14 18-40 19Z" />}
            {avatar.hair === 'curl' && <path d="M56 72q-8-19 4-30 9-8 19 0 6-17 21-13 14 1 16 16 16 0 14 18l-8 13-10-15q-22 12-56 11Z" />}
          </g>
        )}

        {accessoryAsset ? (
          <image href={accessoryAsset} x="0" y="0" width="180" height="180" preserveAspectRatio="xMidYMid meet" />
        ) : avatar.accessory !== 'none' && (
          <g className={`petgame-avatar-layer petgame-avatar-accessory accessory-${avatar.accessory}`}>
            {avatar.accessory === 'glasses' && <><circle cx="77" cy="78" r="12" /><circle cx="105" cy="78" r="12" /><path d="M89 78h4m-28 0h-4m56 0h-4" /></>}
            {avatar.accessory === 'flower' && <><circle cx="121" cy="52" r="6" /><circle cx="114" cy="52" r="5" /><circle cx="118" cy="45" r="5" /><circle cx="124" cy="46" r="5" /><circle cx="121" cy="49" r="2" /></>}
            {avatar.accessory === 'crown' && <path d="m59 53 7-21 17 14 11-18 12 18 17-14 6 21H59Z" />}
            {avatar.accessory === 'bow' && <path d="M121 50c-9-10-18-5-14 4 3 7 10 6 14 2 4 4 11 5 14-2 4-9-5-14-14-4Z" />}
          </g>
        )}
      </svg>
    </div>
  );
}
