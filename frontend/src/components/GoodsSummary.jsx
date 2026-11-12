import React from 'react'
import { goodsLine, vehicleLabel } from '../vehicles'

// Goods, receiver and notes of a booking. Rendered inside the booking cards
// of both the customer and the driver app. Renders nothing for bookings
// that carry no goods details.
const GoodsSummary = ({ ride, showReceiverPhone = false, className = '' }) => {
    const goods = goodsLine(ride)
    if (!goods && !ride?.receiverName && !ride?.notes) return null

    return (
        <div className={`w-full bg-amber-50 border border-amber-200 rounded-2xl p-3 space-y-2 ${className}`}>
            {(goods || ride?.vehicleType) && (
                <div className='flex items-start gap-3'>
                    <i className="ri-box-3-fill text-amber-600 mt-0.5"></i>
                    <div className='min-w-0'>
                        <p className='text-[10px] uppercase font-bold text-amber-700/70'>Goods · {vehicleLabel(ride?.vehicleType)}</p>
                        <p className='font-semibold text-gray-800 text-sm'>{goods || 'Not specified'}</p>
                    </div>
                </div>
            )}
            {ride?.receiverName && (
                <div className='flex items-start gap-3'>
                    <i className="ri-user-received-2-fill text-amber-600 mt-0.5"></i>
                    <div className='min-w-0 flex-1'>
                        <p className='text-[10px] uppercase font-bold text-amber-700/70'>Receiver at drop</p>
                        <p className='font-semibold text-gray-800 text-sm'>
                            {ride.receiverName}
                            {ride.receiverPhone && !showReceiverPhone && <span className='font-normal text-gray-500'> · {ride.receiverPhone}</span>}
                        </p>
                    </div>
                    {showReceiverPhone && ride.receiverPhone && (
                        <a
                            href={`tel:${ride.receiverPhone.replace(/[^\d+]/g, '')}`}
                            className='flex items-center gap-1 text-xs font-bold bg-black text-white px-3 py-1.5 rounded-xl flex-shrink-0'
                        >
                            <i className="ri-phone-fill"></i> {ride.receiverPhone}
                        </a>
                    )}
                </div>
            )}
            {ride?.notes && (
                <div className='flex items-start gap-3'>
                    <i className="ri-sticky-note-fill text-amber-600 mt-0.5"></i>
                    <p className='text-sm text-gray-700'>{ride.notes}</p>
                </div>
            )}
        </div>
    )
}

export default GoodsSummary
