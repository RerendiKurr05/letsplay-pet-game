import { getGameAsset } from '../assets';

const DEFAULT_PARTS = {
  body: 'cream',
  outfit: 'berry',
  eyes: 'round',
  hair: 'tuft',
  accessory: 'none',
};

export default function PetArtwork({ mood = 'neutral', parts = {} }) {
  const avatar = { ...DEFAULT_PARTS, ...parts };
  const layerAsset = (layer) => getGameAsset('petLayers', layer, avatar[layer]);
  const bodyAsset = layerAsset('body');
  const outfitAsset = layerAsset('outfit');
  const eyesAsset = layerAsset('eyes');
  const hairAsset = layerAsset('hair');
  const accessoryAsset = layerAsset('accessory');

  return (
    <div className={`petgame-artwork petgame-pet-artwork petgame-artwork-${mood}`}>
      <svg
        viewBox="0 0 180 180"
        className="petgame-artwork-svg"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label={`${mood} layered custom pet`}
      >
        <ellipse className="petgame-artwork-shadow" cx="90" cy="158" rx="47" ry="8" />

        <g className={`petgame-avatar-layer petgame-avatar-body body-${avatar.body}`}>
          {bodyAsset ? (
            <image href={bodyAsset} x="0" y="0" width="180" height="180" preserveAspectRatio="xMidYMid meet" />
          ) : (
            <path className="petgame-avatar-torso" d="M48 119q42-21 84 0l13 37q-55 20-110 0l13-37Z" />
          )}
        </g>

        <g className={`petgame-avatar-layer petgame-avatar-outfit outfit-${avatar.outfit}`}>
          {outfitAsset ? (
            <image href={outfitAsset} x="0" y="0" width="180" height="180" preserveAspectRatio="xMidYMid meet" />
          ) : (
            <path d="M45 116Q90 94 135 116l16 41q-61 20-122 0l16-41Z" />
          )}
        </g>

        {!bodyAsset && (
          <g className={`petgame-avatar-layer petgame-avatar-body body-${avatar.body}`}>
            <ellipse className="petgame-ear" cx="49" cy="52" rx="11" ry="15" />
            <ellipse className="petgame-ear" cx="131" cy="52" rx="11" ry="15" />
            <path className="petgame-head" d="M90 28c-25 0-41 17-41 44 0 27 17 46 41 46s41-19 41-46c0-27-16-44-41-44Z" />
          </g>
        )}

        <g className={`petgame-avatar-layer petgame-avatar-eyes eyes-${avatar.eyes}`}>
          {eyesAsset ? (
            <image href={eyesAsset} x="0" y="0" width="180" height="180" preserveAspectRatio="xMidYMid meet" />
          ) : avatar.eyes === 'sleepy' ? (
            <path d="M59 85q9-8 18 0m26 0q9-8 18 0" />
          ) : avatar.eyes === 'starry' ? (
            <>
              <path d="m68 74 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Zm44 0 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z" />
            </>
          ) : (
            <>
              <ellipse cx="69" cy="83" rx={avatar.eyes === 'spark' ? 5 : 4} ry="6" />
              <ellipse cx="111" cy="83" rx={avatar.eyes === 'spark' ? 5 : 4} ry="6" />
              {avatar.eyes === 'spark' && <path className="petgame-eye-glint" d="M67 81h.1m42 0h.1" />}
            </>
          )}
        </g>

        <g className="petgame-avatar-layer petgame-avatar-cheeks">
          <ellipse cx="54" cy="99" rx="8" ry="4" />
          <ellipse cx="126" cy="99" rx="8" ry="4" />
        </g>

        <g className="petgame-avatar-layer petgame-avatar-mouth">
          <path d="M81 98q9 11 18 0" />
        </g>

        {hairAsset ? (
          <image className="petgame-avatar-layer" href={hairAsset} x="0" y="0" width="180" height="180" preserveAspectRatio="xMidYMid meet" />
        ) : avatar.hair !== 'none' && (
          <g className={`petgame-avatar-layer petgame-avatar-hair hair-${avatar.hair}`}>
            {avatar.hair === 'tuft' && <path d="M49 66q-5-22 8-31 2 11 10 15 4-20 20-22 3 16 16 21l10-12q13 13 3 31-20-2-31-16-10 16-36 14Z" />}
            {avatar.hair === 'fringe' && <path d="M45 67q-5-28 13-37 7 12 18 14 9-15 25-11 17 14 11 37-15-4-25-20-14 18-42 17Z" />}
            {avatar.hair === 'curl' && <path d="M44 68q-8-17 3-29 9-8 19-1 8-16 22-12 14 1 16 15 18 0 17 18l-9 17-10-17q-22 12-58 9Z" />}
          </g>
        )}

        {accessoryAsset ? (
          <image className="petgame-avatar-layer" href={accessoryAsset} x="0" y="0" width="180" height="180" preserveAspectRatio="xMidYMid meet" />
        ) : avatar.accessory !== 'none' && (
          <g className={`petgame-avatar-layer petgame-avatar-accessory accessory-${avatar.accessory}`}>
            {avatar.accessory === 'glasses' && (
              <g>
                <circle cx="69" cy="84" r="12" />
                <circle cx="111" cy="84" r="12" />
                <path d="M81 84h18m-34 0h-8m66 0h-8" />
              </g>
            )}
            {avatar.accessory === 'flower' && (
              <g>
                <circle cx="128" cy="51" r="5" />
                <circle cx="121" cy="51" r="5" />
                <circle cx="124" cy="45" r="5" />
                <circle cx="131" cy="45" r="5" />
                <circle cx="127" cy="47" r="2" />
              </g>
            )}
            {avatar.accessory === 'crown' && <path d="m55 52 7-21 17 14 11-18 12 18 17-14 6 21H55Z" />}
            {avatar.accessory === 'bow' && (
              <path d="M126 49c-9-10-18-5-14 4 3 7 10 6 14 2 4 4 11 5 14-2 4-9-5-14-14-4Z" />
            )}
          </g>
        )}
      </svg>
    </div>
  );
}
