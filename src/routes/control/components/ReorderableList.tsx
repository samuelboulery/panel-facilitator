// Liste verticale réordonnable (Reorder framer-motion) — drag sur la carte
// entière (pas d'icône), mise à jour optimiste, persistance au drop (parent).
import { useEffect, useRef, useState } from 'react'
import { Reorder } from 'framer-motion'

interface ReorderableListProps<T extends { id: string }> {
  items: T[]
  onReorder: (ids: string[]) => void
  renderItem: (item: T, handle: React.ReactNode) => React.ReactNode
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
  renderItem: (item: T, handle: React.ReactNode) => React.ReactNode
  onDragStart: () => void
  onDragEnd: () => void
}) {
  return (
    <Reorder.Item
      value={item}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {renderItem(item, null)}
    </Reorder.Item>
  )
}
