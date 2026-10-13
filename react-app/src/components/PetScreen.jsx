import { useEffect, useRef, useState } from 'react';
import { PetGameAPI } from '../api';
import { getGameAsset } from '../assets';
import AvatarArtwork from './AvatarArtwork';
import Icon from './Icon';
import PetArtwork from './PetArtwork';
import { playSoundCue } from '../sound';
import useLiveRefresh from '../hooks/useLiveRefresh';
import AnimatedNumber from './AnimatedNumber';

const MOOD_LABEL = {
  sad: 'Feeling low',
  neutral: 'Feeling good',
  happy: 'Feeling great',
};

const CARE_ACTIONS = [
  { action: 'feed', label: 'Feed', icon: 'feed' },
  { action: 'play', label: 'Play', icon: 'play' },
  { action: 'clean', label: 'Clean', icon: 'clean' },
];

const DEFAULT_PARTS = {
  body: 'cream',
  outfit: 'berry',
  eyes: 'round',
  hair: 'tuft',
  accessory: 'none',
};

const CUSTOM_LAYERS = [
  { id: 'body', label: 'Body', options: [['cream', 'Warm cream'], ['peach', 'Peach'], ['mint', 'Mint'], ['lavender', 'Lavender']] },
  { id: 'outfit', label: 'Outfit', options: [['berry', 'Berry'], ['sky', 'Sky blue'], ['sage', 'Sage'], ['sunset', 'Sunset']] },
  { id: 'eyes', label: 'Eyes', options: [['round', 'Round'], ['spark', 'Bright'], ['sleepy', 'Sleepy'], ['starry', 'Starry']] },
  { id: 'hair', label: 'Hair', options: [['none', 'None'], ['tuft', 'Tuft'], ['fringe', 'Fringe'], ['curl', 'Curly']] },
  { id: 'accessory', label: 'Accessory', options: [['none', 'None'], ['glasses', 'Glasses'], ['flower', 'Flower'], ['crown', 'Crown'], ['bow', 'Bow']] },
];

export default function PetScreen({ soundEnabled = true }) {
  const [pet, setPet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(null);
  const [cardResult, setCardResult] = useState(null);
  const [cardStage, setCardStage] = useState(null);
  const [activeTab, setActiveTab] = useState('shop');
  const [centerOpen, setCenterOpen] = useState(false);
  const [drawerDragY, setDrawerDragY] = useState(0);
  const [drawerDragging, setDrawerDragging] = useState(false);
  const [customizationTarget, setCustomizationTarget] = useState(null);
  const [customizeMenuOpen, setCustomizeMenuOpen] = useState(false);
  const [activeLayer, setActiveLayer] = useState('body');
  const [customParts, setCustomParts] = useState(DEFAULT_PARTS);
  const [avatarParts, setAvatarParts] = useState(DEFAULT_PARTS);
  const [customizationSaved, setCustomizationSaved] = useState(false);
  const [petAction, setPetAction] = useState(null);
  const [error, setError] = useState(null);
  const drawTimerRef = useRef(null);
  const drawerDragRef = useRef(null);
  const ignoreDrawerClickRef = useRef(false);
  const customizationMenuRef = useRef(null);
  const customizationMenuTriggerRef = useRef(null);

  function toggleCenterDrawer() {
    setCenterOpen((open) => !open);
    playSoundCue('drawer', soundEnabled);
  }

  function handleDrawerPointerDown(event) {
    drawerDragRef.current = { pointerId: event.pointerId, startY: event.clientY, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handleDrawerPointerMove(event) {
    const drag = drawerDragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    const delta = event.clientY - drag.startY;
    if (Math.abs(delta) > 10) {
      drag.moved = true;
      setDrawerDragging(true);
    }
    const limit = centerOpen ? 170 : 90;
    const clamped = centerOpen
      ? Math.max(0, Math.min(limit, delta))
      : Math.min(0, Math.max(-limit, delta));
    setDrawerDragY(clamped);
  }

  function handleDrawerPointerUp(event) {
    const drag = drawerDragRef.current;
    if (drag?.pointerId !== event.pointerId) return;
    const delta = event.clientY - drag.startY;
    if (drag.moved) {
      const nextOpen = centerOpen ? delta < 44 : delta < -44;
      if (nextOpen !== centerOpen) playSoundCue('drawer', soundEnabled);
      setCenterOpen(nextOpen);
      ignoreDrawerClickRef.current = true;
    }
    drawerDragRef.current = null;
    setDrawerDragging(false);
    setDrawerDragY(0);
  }

  function handleDrawerPointerCancel() {
    drawerDragRef.current = null;
    setDrawerDragging(false);
    setDrawerDragY(0);
  }

  function selectCenterTab(tab) {
    setActiveTab(tab);
    playSoundCue('tab', soundEnabled);
  }

  useEffect(() => {
    if (!customizeMenuOpen) return undefined;

    function closeMenu(event) {
      if (event.type === 'keydown' && event.key === 'Escape') {
        setCustomizeMenuOpen(false);
        customizationMenuTriggerRef.current?.focus();
      } else if (
        event.type === 'pointerdown' &&
        !customizationMenuRef.current?.contains(event.target)
      ) {
        setCustomizeMenuOpen(false);
      }
    }

    document.addEventListener('pointerdown', closeMenu);
    document.addEventListener('keydown', closeMenu);
    return () => {
      document.removeEventListener('pointerdown', closeMenu);
      document.removeEventListener('keydown', closeMenu);
    };
  }, [customizeMenuOpen]);

  useEffect(() => {
    PetGameAPI.getPetState()
      .then((result) => {
        setPet(result);
        setCustomParts({ ...DEFAULT_PARTS, ...(result.custom_parts || {}) });
        setAvatarParts({ ...DEFAULT_PARTS, hair: 'none', ...(result.avatar_parts || {}) });
        if (result.card_drawn_today && result.todays_card) {
          setCardResult(result.todays_card);
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    return () => window.clearTimeout(drawTimerRef.current);
  }, []);

  useLiveRefresh(async () => {
    try {
      const result = await PetGameAPI.getPetState();
      setPet(result);
      setError(null);
    } catch (refreshError) {
      setError(refreshError.message);
    }
  });

  async function handleCareAction(action) {
    setActionPending(action);
    setPetAction(action);
    setError(null);
    playSoundCue('care', soundEnabled);
    try {
      const result = await PetGameAPI.doCareAction(action);
      setPet((prev) => ({ ...prev, ...result }));
      window.setTimeout(() => setPetAction(null), 650);
    } catch (e) {
      setError(e.message);
      setPetAction(null);
    } finally {
      setActionPending(null);
    }
  }

  function handleOpenCard() {
    if (pet.card_drawn_today || actionPending) return;
    setCardStage('ready');
  }

  async function handleDrawCard() {
    if (pet.card_drawn_today || actionPending) return;
    setActionPending('card');
    setError(null);
    setCardStage('pulling');
    playSoundCue('card-start', soundEnabled);
    try {
      const [result] = await Promise.all([
        PetGameAPI.drawCard(),
        new Promise((resolve) => window.setTimeout(resolve, 1800)),
      ]);
      setCardResult(result);
      setPet((prev) => ({
        ...prev,
        lifetime_points: result.lifetime_points,
        card_drawn_today: true,
      }));
      drawTimerRef.current = window.setTimeout(() => {
        setCardStage('revealed');
        playSoundCue('card-reveal', soundEnabled);
      }, 180);
    } catch (e) {
      setError(e.message);
      setCardStage(null);
    } finally {
      setActionPending(null);
    }
  }

  async function handleSaveCustomization() {
    setActionPending('customize');
    setError(null);
    try {
      const parts = customizationTarget === 'avatar' ? avatarParts : customParts;
      const result = await PetGameAPI.saveCustomization(customizationTarget, parts);
      if (customizationTarget === 'avatar') {
        setPet((previous) => ({ ...previous, avatar_parts: result.avatar_parts }));
      } else {
        setPet((previous) => ({ ...previous, ...result }));
      }
      setCustomizationSaved(true);
      playSoundCue('save', soundEnabled);
    } catch (e) {
      setError(e.message);
    } finally {
      setActionPending(null);
    }
  }

  async function handleSavePetName(petName) {
    setActionPending('pet-name');
    setError(null);
    try {
      const result = await PetGameAPI.savePetName(petName);
      setPet((previous) => ({ ...previous, pet_name: result.pet_name }));
      return true;
    } catch (saveError) {
      setError(saveError.message);
      return false;
    } finally {
      setActionPending(null);
    }
  }

  if (loading) return <div className="petgame-loading">Loading your pet…</div>;
  if (!pet) return <div className="petgame-error">Couldn&apos;t load pet data. {error}</div>;

  const moodMeter = Math.max(0, Math.min(100, Number(pet.mood_meter) || 0));
  const moodLabel = MOOD_LABEL[pet.mood_state] || MOOD_LABEL.neutral;

  if (customizationTarget) {
    const editingAvatar = customizationTarget === 'avatar';
    return (
      <AvatarStudioScreen
        pet={pet}
        mood={pet.mood_state}
        target={customizationTarget}
        customParts={editingAvatar ? avatarParts : customParts}
        activeLayer={activeLayer}
        actionPending={actionPending}
        customizationSaved={customizationSaved}
        error={error}
        soundEnabled={soundEnabled}
        onSavePetName={handleSavePetName}
        onBack={() => setCustomizationTarget(null)}
        onLayerChange={(layer) => {
          setActiveLayer(layer);
          setCustomizationSaved(false);
          playSoundCue('select', soundEnabled);
        }}
        onPartChange={(value) => {
          if (editingAvatar) {
            setAvatarParts((previous) => ({ ...previous, [activeLayer]: value }));
          } else {
            setCustomParts((previous) => ({ ...previous, [activeLayer]: value }));
          }
          setCustomizationSaved(false);
          playSoundCue('select', soundEnabled);
        }}
        onSave={handleSaveCustomization}
      />
    );
  }

  return (
    <div className={`petgame-pet-view${centerOpen ? ' drawer-open' : ''}`}>
      {error && (
        <div className="petgame-banner-error" role="alert">
          {error}
        </div>
      )}

      <section className={`petgame-pet-card${petAction ? ` is-reacting action-${petAction}` : ''}`} aria-label={`${pet.pet_name}, your pet`}>
        <div className="petgame-pet-card-header">
          <div className="petgame-pet-name">{pet.pet_name}</div>
          <div className="petgame-pet-header-actions">
            <button
              className="petgame-points-toggle"
              type="button"
              aria-label={centerOpen ? 'Close points and rewards' : 'Show points and rewards'}
              aria-expanded={centerOpen}
              aria-controls="petgame-shop-center"
              title={centerOpen ? 'Close points and rewards' : 'Show points and rewards'}
              onClick={toggleCenterDrawer}
            >
              <Icon name="points" size={19} />
            </button>
            <div className="petgame-customization-menu" ref={customizationMenuRef}>
              <button
                ref={customizationMenuTriggerRef}
                className="petgame-customization-menu-trigger"
                type="button"
                aria-label="Customize"
                aria-expanded={customizeMenuOpen}
                aria-controls="petgame-customization-menu"
                onClick={() => setCustomizeMenuOpen((open) => !open)}
              >
                <Icon name="hanger" size={19} />
              </button>
              {customizeMenuOpen && (
                <div
                  className="petgame-customization-menu-popover"
                  id="petgame-customization-menu"
                  role="group"
                  aria-label="Customization options"
                >
                  <button
                    className="petgame-customization-shortcut"
                    type="button"
                    onClick={() => {
                      setCustomizeMenuOpen(false);
                      setCustomizationTarget('pet');
                      setCustomizationSaved(false);
                      playSoundCue('select', soundEnabled);
                    }}
                  >
                    <Icon name="pet" size={19} />
                    <span>Customize pet</span>
                  </button>
                  <button
                    className="petgame-customization-shortcut"
                    type="button"
                    onClick={() => {
                      setCustomizeMenuOpen(false);
                      setCustomizationTarget('avatar');
                      setCustomizationSaved(false);
                      playSoundCue('select', soundEnabled);
                    }}
                  >
                    <Icon name="body" size={19} />
                    <span>Customize avatar</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
        <section className="petgame-mood" aria-label={`Pet mood: ${moodLabel}`}>
          <div className="petgame-mood-heading">
            <span className={`petgame-mood-icon mood-${pet.mood_state}`} aria-hidden="true" />
            <span>{moodLabel}</span>
            <strong>{moodMeter}%</strong>
          </div>
          <div
            className="petgame-mood-track"
            role="progressbar"
            aria-label="Pet mood"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-valuenow={moodMeter}
          >
            <div className="petgame-mood-fill" style={{ width: `${moodMeter}%` }} />
          </div>
        </section>
        <div
          className={`petgame-pet-stage mood-${pet.mood_state}`}
          style={getGameAsset('petBackground') ? { backgroundImage: `url("${getGameAsset('petBackground')}")` } : undefined}
        >
          <section className="petgame-status" aria-label="Your game points">
            <div className="petgame-status-card petgame-points-card">
              <span className="petgame-status-icon"><Icon name="points" size={17} /></span>
              <span className="petgame-status-copy">
                <span className="petgame-status-label">LP points</span>
                <strong><AnimatedNumber value={Number(pet.lifetime_points)} /></strong>
              </span>
            </div>
            <div className="petgame-status-card petgame-attendance-points-card">
              <span className="petgame-status-icon"><Icon name="check" size={17} /></span>
              <span className="petgame-status-copy">
                <span className="petgame-status-label">Attendance pts</span>
                <strong><AnimatedNumber value={Number(pet.attendance_points || 0)} /></strong>
                <small>{pet.streak_count} {pet.streak_count === 1 ? 'day' : 'days'} in a row</small>
              </span>
            </div>
          </section>
          <div className="petgame-sunshine" aria-hidden="true" />
          <PetArtwork mood={pet.mood_state} parts={customParts} />
          <span className="petgame-pet-caption">
            {pet.pet_type === 'mascot' ? 'Your mascot companion' : 'Your custom companion'}
          </span>
        </div>
      </section>

      <section className="petgame-care" aria-label="Take care of your pet">
        {CARE_ACTIONS.map(({ action, label, icon }) => (
          <button
            key={action}
            className="petgame-care-button"
            type="button"
            disabled={Boolean(actionPending)}
            onClick={() => handleCareAction(action)}
            aria-label={`${label} your pet`}
          >
            <span className="petgame-care-icon" aria-hidden="true">
              {getGameAsset('icons', `care-${icon}`) ? (
                <img src={getGameAsset('icons', `care-${icon}`)} alt="" />
              ) : (
                <CareIcon name={icon} />
              )}
            </span>
            <span>{actionPending === action ? '…' : label}</span>
          </button>
        ))}
      </section>

      <section
        className={`petgame-center${centerOpen ? ' is-open' : ''}${drawerDragging ? ' is-dragging' : ''}`}
        id="petgame-shop-center"
        style={drawerDragY ? { transform: `translateY(${drawerDragY}px)` } : undefined}
        aria-label="Shop and Goodie Center"
      >
        <button
          className="petgame-drawer-grab"
          type="button"
          aria-expanded={centerOpen}
          aria-label={centerOpen ? 'Close Shop and Goodie Center' : 'Open Shop and Goodie Center'}
          onClick={() => {
            if (ignoreDrawerClickRef.current) {
              ignoreDrawerClickRef.current = false;
              return;
            }
            toggleCenterDrawer();
          }}
          onPointerDown={handleDrawerPointerDown}
          onPointerMove={handleDrawerPointerMove}
          onPointerUp={handleDrawerPointerUp}
          onPointerCancel={handleDrawerPointerCancel}
        >
          <span className="petgame-drawer-handle" aria-hidden="true" />
        </button>
        <button
          className="petgame-center-drawer-toggle"
          type="button"
          aria-expanded={centerOpen}
          onClick={toggleCenterDrawer}
          onPointerDown={handleDrawerPointerDown}
          onPointerMove={handleDrawerPointerMove}
          onPointerUp={handleDrawerPointerUp}
          onPointerCancel={handleDrawerPointerCancel}
        >
          <span className="petgame-center-drawer-title">
            <strong>Shop &amp; Goodie Center</strong>
            <small>{centerOpen ? 'Swipe down or tap to close' : 'Swipe up or tap to explore'}</small>
          </span>
          <Icon name="arrow" size={18} />
        </button>

        <div className="petgame-center-drawer" aria-hidden={!centerOpen}>
            <div className="petgame-center-tabs" role="tablist" aria-label="Pet center">
              <button
                id="petgame-tab-shop"
                className={activeTab === 'shop' ? 'active' : ''}
                type="button"
                role="tab"
                aria-selected={activeTab === 'shop'}
                aria-controls="petgame-center-panel"
                onClick={() => selectCenterTab('shop')}
              >
                Shop
              </button>
              <span className="petgame-tab-divider" aria-hidden="true" />
              <button
                id="petgame-tab-goodies"
                className={activeTab === 'goodies' ? 'active' : ''}
                type="button"
                role="tab"
                aria-selected={activeTab === 'goodies'}
                aria-controls="petgame-center-panel"
                onClick={() => selectCenterTab('goodies')}
              >
                Goodie Center
              </button>
            </div>

            <div
              className="petgame-center-panel"
              id="petgame-center-panel"
              role="tabpanel"
              aria-labelledby={activeTab === 'shop' ? 'petgame-tab-shop' : 'petgame-tab-goodies'}
            >
              {activeTab === 'shop' ? (
                <>
                  <p className="petgame-center-hint">A little something for your buddy</p>
                  <div className="petgame-shop-grid" aria-label="Shop items coming soon">
                    {Array.from({ length: 12 }, (_, index) => (
                      <div className="petgame-shop-item" key={index} aria-hidden="true">
                        {getGameAsset('shopItems', index) ? (
                          <img src={getGameAsset('shopItems', index)} alt="" />
                        ) : (
                          <Icon name="star" size={17} />
                        )}
                      </div>
                    ))}
                  </div>
                  <p className="petgame-coming-soon">Cosmetics and rewards are being prepared.</p>
                </>
              ) : (
                <div className="petgame-goodie-sections">
                  <section className="petgame-goodie-section" aria-labelledby="petgame-cards-heading">
                    <div className="petgame-goodie-section-heading">
                      <h3 id="petgame-cards-heading">Cards</h3>
                      <span>Test your luck</span>
                    </div>
                    <div className="petgame-goodie-card">
                      <div className="petgame-goodie-art"><Icon name="card" size={24} /></div>
                      <div className="petgame-goodie-copy">
                        <strong>Today&apos;s card</strong>
                        <span>
                          {pet.card_unlocked
                            ? 'A small daily surprise, just for you.'
                            : 'Keep your attendance streak going to unlock a daily card.'}
                        </span>
                      </div>
                      {cardResult ? (
                        <div className="petgame-card-result" role="status">
                          <Icon name="check" size={16} />
                          {cardResult.card_type === 'bonus'
                            ? `Bonus card · +${cardResult.points_awarded} points`
                            : 'A little reminder: small steps add up.'}
                          <span>Drawn for today</span>
                        </div>
                      ) : (
                        <button
                          className="petgame-draw-button"
                          type="button"
                          disabled={!pet.card_unlocked || Boolean(actionPending) || pet.card_drawn_today}
                          onClick={handleOpenCard}
                        >
                          {pet.card_drawn_today
                            ? 'Your draw is complete today'
                            : pet.card_unlocked
                              ? 'Reveal today’s card'
                              : 'Unlocks at day 3 streak'}
                        </button>
                      )}
                    </div>
                  </section>
                  <section className="petgame-goodie-section" aria-labelledby="petgame-goodies-heading">
                    <div className="petgame-goodie-section-heading">
                      <h3 id="petgame-goodies-heading">Goodies</h3>
                      <span>For you to enjoy</span>
                    </div>
                    <div className="petgame-goodie-slots" aria-label="Goodies coming soon">
                      {Array.from({ length: 8 }, (_, index) => (
                        <div className="petgame-goodie-slot" key={index} aria-hidden="true">
                          {getGameAsset('goodieItems', index)
                            ? <img src={getGameAsset('goodieItems', index)} alt="" />
                            : <Icon name="star" size={17} />}
                        </div>
                      ))}
                    </div>
                    <p className="petgame-coming-soon">Little treats are being prepared.</p>
                  </section>
                </div>
              )}
            </div>
        </div>
      </section>

      {cardStage && (
        <div className="petgame-card-overlay" role="dialog" aria-modal="true" aria-labelledby="petgame-card-title">
          <div className={`petgame-card-scene stage-${cardStage}`}>
            <button
              className="petgame-card-close"
              type="button"
              aria-label="Close card reveal"
              disabled={cardStage === 'pulling'}
              onClick={() => setCardStage(null)}
            >
              <Icon name="close" size={20} />
            </button>
            <span className="petgame-eyebrow">A LITTLE MOMENT FOR YOU</span>
            <h2 id="petgame-card-title">
              {cardStage === 'revealed'
                ? 'Your card is here.'
                : cardStage === 'ready'
                  ? 'Your daily card is waiting.'
                  : 'A surprise is on its way.'}
            </h2>
            {cardStage === 'ready' ? (
              <button
                className="petgame-draw-card-trigger"
                type="button"
                aria-label="Tap your daily card to draw it"
                disabled={Boolean(actionPending)}
                onClick={handleDrawCard}
              >
                <DrawCard />
                <span>Tap your card to reveal it</span>
              </button>
            ) : (
              <>
                <DrawCard cardResult={cardResult} revealed={cardStage === 'revealed'} />
                {cardStage === 'pulling' && <span className="petgame-card-pull-caption">Hold on to the moment…</span>}
              </>
            )}
            {cardStage === 'revealed' && (
              <button className="petgame-card-done" type="button" onClick={() => setCardStage(null)}>
                Nice
                <Icon name="check" size={17} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function AvatarStudioScreen({
  pet,
  mood,
  target,
  customParts,
  activeLayer,
  actionPending,
  customizationSaved,
  error,
  onSavePetName,
  onBack,
  onLayerChange,
  onPartChange,
  onSave,
}) {
  const [isEditingPetName, setIsEditingPetName] = useState(false);
  const [petNameDraft, setPetNameDraft] = useState(pet.pet_name);
  const [petNameSaved, setPetNameSaved] = useState(false);
  const activeLayerOptions = CUSTOM_LAYERS.find((layer) => layer.id === activeLayer).options;
  const editingAvatar = target === 'avatar';
  const previewName = editingAvatar ? 'Ilham' : pet.pet_name;

  async function savePetName() {
    const saved = await onSavePetName(petNameDraft);
    if (saved) {
      setIsEditingPetName(false);
      setPetNameSaved(true);
    }
  }

  return (
    <section className="petgame-customization-view" aria-labelledby="petgame-customization-title">
      <header className="petgame-customization-header">
        <button className="petgame-customization-back" type="button" onClick={onBack}>
          <Icon name="back" size={18} />
          <span>Back to pet room</span>
        </button>
        <div>
          <span className="petgame-eyebrow">{editingAvatar ? 'AVATAR STUDIO' : 'PET STUDIO'}</span>
          <h1 id="petgame-customization-title">{editingAvatar ? 'Customize your avatar' : `Customize ${pet.pet_name}`}</h1>
        </div>
      </header>

      {error && <div className="petgame-banner-error" role="alert">{error}</div>}

      {editingAvatar ? (
        <div className="petgame-name-field is-static" aria-label="Player name">
          <span className="petgame-name-text">Ilham</span>
        </div>
      ) : (
        <div className={`petgame-name-field${isEditingPetName ? ' is-editing' : ''}`}>
          {isEditingPetName ? (
            <form
              className="petgame-name-editor-form"
              onSubmit={(event) => {
                event.preventDefault();
                savePetName();
              }}
            >
              <input
                autoFocus
                maxLength={50}
                aria-label="New pet name"
                value={petNameDraft}
                onChange={(event) => {
                  setPetNameDraft(event.target.value);
                  setPetNameSaved(false);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setPetNameDraft(pet.pet_name);
                    setIsEditingPetName(false);
                  }
                }}
              />
              <button
                className="petgame-name-commit"
                type="button"
                aria-label="Save pet name"
                disabled={actionPending === 'pet-name'}
                onClick={savePetName}
              >
                <Icon name={actionPending === 'pet-name' ? 'clock' : 'check'} size={18} />
              </button>
            </form>
          ) : (
            <>
              <span className="petgame-name-text">{pet.pet_name}{petNameSaved ? ' · Saved' : ''}</span>
              <button
                className="petgame-name-commit"
                type="button"
                aria-label="Edit pet name"
                onClick={() => {
                  setPetNameDraft(pet.pet_name);
                  setPetNameSaved(false);
                  setIsEditingPetName(true);
                }}
              >
                <Icon name="edit" size={17} />
              </button>
            </>
          )}
        </div>
      )}

      <div className="petgame-customization-preview" aria-label={`Live ${editingAvatar ? 'avatar' : 'pet'} preview`}>
        <span className="petgame-customization-preview-name">{previewName}</span>
        {editingAvatar
          ? <AvatarArtwork mood={mood} parts={customParts} />
          : <PetArtwork mood={mood} parts={customParts} />}
        <span className="petgame-customization-preview-caption">Changes appear as you customize</span>
      </div>

      <div className="petgame-customizer">
        <div className="petgame-customizer-heading">
          <div>
            <span className="petgame-eyebrow">{editingAvatar ? 'YOUR AVATAR' : 'YOUR PET'}</span>
            <h2>{editingAvatar ? 'Make it feel like you.' : 'Build your pet’s look.'}</h2>
          </div>
          <span className="petgame-customizer-layer-count">5 LAYERS</span>
        </div>
        <div className="petgame-layer-tabs" role="tablist" aria-label={`${editingAvatar ? 'Avatar' : 'Pet'} layers`}>
          {CUSTOM_LAYERS.map((layer) => (
            <button
              className={activeLayer === layer.id ? 'active' : ''}
              key={layer.id}
              type="button"
              role="tab"
              aria-selected={activeLayer === layer.id}
              onClick={() => onLayerChange(layer.id)}
            >
              <Icon name={layer.id} size={17} />
              <span>{layer.label}</span>
            </button>
          ))}
        </div>
        <div className="petgame-layer-options" role="group" aria-label={`Choose ${activeLayer}`}>
          {activeLayerOptions.map(([value, label]) => (
            <button
              className={`petgame-layer-option layer-option-${activeLayer}-${value}${customParts[activeLayer] === value ? ' selected' : ''}`}
              key={value}
              type="button"
              aria-pressed={customParts[activeLayer] === value}
              onClick={() => onPartChange(value)}
            >
              <span className={`petgame-option-swatch swatch-${activeLayer}-${value}`}>
                <LayerPreview layer={activeLayer} value={value} />
              </span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        <div className="petgame-customizer-footer">
          <span>{customizationSaved ? 'Your look is saved.' : `Preview updates instantly; save your ${editingAvatar ? 'avatar' : 'pet'} when it feels right.`}</span>
          <button
            className="petgame-customizer-save"
            type="button"
            disabled={actionPending === 'customize'}
            onClick={onSave}
          >
            {actionPending === 'customize' ? 'Saving…' : `Save ${editingAvatar ? 'avatar' : 'pet'}`}
            {actionPending !== 'customize' && <Icon name="check" size={16} />}
          </button>
        </div>
      </div>
    </section>
  );
}

function DrawCard({ cardResult, revealed = false }) {
  return (
    <span className={`petgame-draw-card${revealed ? ' is-revealed' : ''}`}>
      <span className="petgame-draw-card-back">
        <span className="petgame-card-back-mark"><Icon name="star" size={35} /></span>
        <span>LET&apos;S PLAY</span>
        <small>DAILY CARD</small>
      </span>
      <span className="petgame-draw-card-front">
        <Icon name={cardResult?.card_type === 'bonus' ? 'points' : 'card'} size={34} />
        <strong>
          {cardResult?.card_type === 'bonus'
            ? `+${cardResult.points_awarded} points`
            : 'Small steps add up.'}
        </strong>
        <span>{cardResult?.card_type === 'bonus' ? 'A little bonus for your journey.' : 'Consistency looks good on you.'}</span>
      </span>
      <span className="petgame-card-sheen" aria-hidden="true" />
    </span>
  );
}

function LayerPreview({ layer, value }) {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      {layer === 'body' && <circle cx="24" cy="24" r="15" />}
      {layer === 'outfit' && <path d="m14 15-7 5 5 7 4-2v13h16V25l4 2 5-7-7-5-5 3h-10l-5-3Z" />}
      {layer === 'eyes' && <><circle cx="17" cy="22" r="3" /><circle cx="31" cy="22" r="3" /><path d={value === 'sleepy' ? 'M13 20q4-4 8 0m7 0q4-4 8 0' : 'M19 31h10'} /></>}
      {layer === 'hair' && (value === 'none' ? <path d="M11 28a13 13 0 0 1 26 0" /> : <path d="M10 28q-3-17 7-19 2 8 7 8 3-11 12-6 7 7 2 20-8-2-12-12-5 9-16 9Z" />)}
      {layer === 'accessory' && (value === 'none' ? <path d="M12 35h24" /> : <path d="m24 7 5 10 11 2-8 8 2 11-10-5-10 5 2-11-8-8 11-2 5-10Z" />)}
    </svg>
  );
}

function CareIcon({ name }) {
  if (name === 'feed') {
    return (
      <svg viewBox="0 0 32 32" focusable="false">
        <path d="M6 17h20l-2 8H8l-2-8Z" />
        <path d="M4 15h24M11 12c0-2 2-2 2-4m5 4c0-2 2-2 2-4" />
      </svg>
    );
  }
  if (name === 'play') {
    return (
      <svg viewBox="0 0 32 32" focusable="false">
        <path d="M16 27c-2.6 0-9-5.1-9-10.5a5 5 0 0 1 9-3 5 5 0 0 1 9 3C25 21.9 18.6 27 16 27Z" />
        <path d="M10 7h.01M16 5h.01M22 7h.01" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" focusable="false">
      <path d="M10 25V14a2 2 0 0 1 4 0v5-9a2 2 0 0 1 4 0v9-7a2 2 0 0 1 4 0v8-4a2 2 0 0 1 4 0v6c0 4-3 6-7 6h-3c-3 0-5-1-6-3l-3-5a2 2 0 0 1 3-2l2 2" />
      <path d="M7 8a4 4 0 0 1 4-4m14 4a4 4 0 0 0-4-4" />
    </svg>
  );
}
