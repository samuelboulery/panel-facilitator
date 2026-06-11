// Liste verticale réordonnable (Reorder framer-motion) — handle ⠿,
// mise à jour optimiste pendant le drag, persistance au drop (parent).
import { useEffect, useRef, useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'

interface ReorderableListProps<T extends { id: string }> {
  items: T[]
  onReorder: (ids: string[]) => void
  renderItem: (item: T) => React.ReactNode
}

export function ReorderableList<T extends { id: string }>({
  items,
  onReorder,
  renderItem,
}: ReorderableListProps<T>) {
  const [order, setOrder] = useState(items)
  const draggingRef = useRef(false)
  // Ref miroir : onDragEnd lit toujours l'ordre final, jamais une closure périmée.
  const orderRef = useRef(order)
  orderRef.current = order

  useEffect(() => {
    if (!draggingRef.current) setOrder(items)
  }, [items])

  return (
    <Reorder.Group
      axis="y"
      values={order}
      onReorder={setOrder}
      className="flex flex-col gap-2"
    >
      {order.map((item) => (
        <Row
          key={item.id}
          item={item}
          renderItem={renderItem}
          onDragStart={() => {
            draggingRef.current = true
          }}
          onDragEnd={() => {
            draggingRef.current = false
            onReorder(orderRef.current.map((i) => i.id))
          }}
        />
      ))}
    </Reorder.Group>
  )
}

function Row<T extends { id: string }>({
  item,
  renderItem,
  onDragStart,
  onDragEnd,
}: {
  item: T
  renderItem: (item: T) => React.ReactNode
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const controls = useDragControls()
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="flex items-start gap-2"
    >
      <button
        type="button"
        aria-label="Réordonner"
        onPointerDown={(e) => controls.start(e)}
        className="cursor-grab touch-none px-1 py-3 text-control-dim"
      >
        ⠿
      </button>
      <div className="min-w-0 flex-1">{renderItem(item)}</div>
    </Reorder.Item>
  )
}
